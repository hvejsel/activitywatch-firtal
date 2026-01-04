"""
Decision Trace Client - Easy-to-use API for recording decision traces.

Provides a fluent interface for creating and recording trace events
with actors, decisions, and tracked objects.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from uuid import uuid4
from contextlib import contextmanager

from .models import (
    TraceEvent,
    Actor,
    ActorType,
    DecisionTrace,
    TrackedObject,
    ObjectType,
    EventOutcome,
)
from .store import DecisionTraceStore


class DecisionTraceClient:
    """
    Client for recording decision traces.

    Provides a simple, fluent API for creating trace events with full
    decision context, actor information, and object tracking.

    Example:
        client = DecisionTraceClient()

        # Simple event
        client.trace("order.created", "New order placed") \\
            .by_user("user-123", "John Doe", role="customer") \\
            .affecting_order("order-456", {"total": 99.99}) \\
            .because("Customer completed checkout") \\
            .record()

        # AI decision with alternatives
        client.trace("inventory.restock", "Restocking SKU-789") \\
            .by_ai("inventory-ai", "GPT-4", confidence=0.92) \\
            .affecting_product("SKU-789") \\
            .because(
                "Stock level below threshold",
                context={"current_stock": 5, "threshold": 10},
                alternatives=[
                    {"action": "wait", "reason": "possible demand decrease"},
                    {"action": "expedite", "reason": "faster but expensive"}
                ],
            ) \\
            .with_risk("medium") \\
            .record()
    """

    def __init__(self, store: DecisionTraceStore = None, db_path: str = None):
        """
        Initialize the client.

        Args:
            store: Optional existing DecisionTraceStore instance
            db_path: Path to SQLite database (if store not provided)
        """
        self.store = store or DecisionTraceStore(db_path)
        self._current_actor: Optional[Actor] = None  # Default actor for traces

    def set_default_actor(self, actor: Actor):
        """Set a default actor for all traces (can be overridden per trace)."""
        self._current_actor = actor

    def trace(self, event_type: str, description: str = "") -> "TraceBuilder":
        """
        Start building a new trace event.

        Args:
            event_type: Type of event (e.g., "order.created", "refund.approved")
            description: Human-readable description

        Returns:
            TraceBuilder for fluent configuration
        """
        builder = TraceBuilder(self, event_type, description)
        if self._current_actor:
            builder._event.actor = self._current_actor
        return builder

    @contextmanager
    def span(self, event_type: str, description: str = ""):
        """
        Context manager for tracking duration of operations.

        Usage:
            with client.span("order.process", "Processing order") as trace:
                trace.by_user("user-123", "John")
                # ... do work ...
            # Duration is automatically calculated when context exits
        """
        builder = self.trace(event_type, description)
        builder._event.timestamp = datetime.utcnow()
        try:
            yield builder
            builder._event.outcome = EventOutcome.SUCCESS
        except Exception as e:
            builder._event.outcome = EventOutcome.FAILURE
            builder._event.error = str(e)
            raise
        finally:
            builder._event.duration = datetime.utcnow() - builder._event.timestamp
            builder.record()

    def query(self, **kwargs) -> List[TraceEvent]:
        """Query events (delegates to store.query_events)."""
        return self.store.query_events(**kwargs)

    def search(self, query: str, limit: int = 50) -> List[TraceEvent]:
        """Search decisions by reasoning text."""
        return self.store.search_decisions(query, limit)

    def get_event(self, event_id: str) -> Optional[TraceEvent]:
        """Get a specific event by ID."""
        return self.store.get_event(event_id)

    def get_object_history(self, **kwargs) -> List[TraceEvent]:
        """Get history for a tracked object."""
        return self.store.get_object_history(**kwargs)

    def get_actor_activity(self, actor_id: str, **kwargs) -> List[TraceEvent]:
        """Get all events by an actor."""
        return self.store.get_actor_activity(actor_id, **kwargs)

    def get_chain(self, event_id: str) -> List[TraceEvent]:
        """Get the full event chain (parent/child hierarchy)."""
        return self.store.get_event_chain(event_id)

    def stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        return self.store.get_stats()


class TraceBuilder:
    """
    Fluent builder for constructing trace events.

    Allows chaining methods to configure all aspects of a trace event
    before recording it to the store.
    """

    def __init__(self, client: DecisionTraceClient, event_type: str, description: str):
        self._client = client
        self._event = TraceEvent(
            event_type=event_type,
            description=description,
        )

    # === Actor Methods ===

    def by(self, actor: Actor) -> "TraceBuilder":
        """Set the actor who performed this action."""
        self._event.actor = actor
        return self

    def by_user(
        self,
        user_id: str,
        name: str,
        email: str = None,
        role: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Set a user as the actor."""
        self._event.actor = Actor.user(user_id, name, email, role, **metadata)
        return self

    def by_ai(
        self,
        agent_id: str,
        name: str,
        model: str = None,
        version: str = None,
        confidence: float = None,
        **metadata
    ) -> "TraceBuilder":
        """Set an AI agent as the actor."""
        self._event.actor = Actor.ai_agent(agent_id, name, model, version, **metadata)
        if confidence is not None:
            if self._event.decision is None:
                self._event.decision = DecisionTrace()
            self._event.decision.confidence = confidence
        return self

    def by_compute(
        self,
        service_id: str,
        name: str,
        service_name: str = None,
        job_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Set a compute engine as the actor."""
        self._event.actor = Actor.compute(service_id, name, service_name, job_id, **metadata)
        return self

    def by_system(self, name: str = "system", **metadata) -> "TraceBuilder":
        """Set system as the actor."""
        self._event.actor = Actor(
            id="system",
            type=ActorType.SYSTEM,
            name=name,
            metadata=metadata,
        )
        return self

    # === Object Methods ===

    def affecting(self, obj: TrackedObject) -> "TraceBuilder":
        """Add a tracked object affected by this event."""
        self._event.objects.append(obj)
        return self

    def affecting_object(
        self,
        object_type: ObjectType,
        object_id: str,
        external_id: str = None,
        name: str = None,
        state_before: Dict = None,
        state_after: Dict = None,
        **metadata
    ) -> "TraceBuilder":
        """Add a tracked object with full configuration."""
        obj = TrackedObject(
            id=object_id,
            type=object_type,
            external_id=external_id,
            name=name,
            metadata=metadata,
            state_before=state_before,
            state_after=state_after,
        )
        self._event.objects.append(obj)
        return self

    def affecting_order(
        self,
        order_id: str,
        state: Dict = None,
        external_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding an order object."""
        return self.affecting_object(
            ObjectType.ORDER,
            f"order-{order_id}",
            external_id=external_id or order_id,
            state_after=state,
            **metadata,
        )

    def affecting_product(
        self,
        product_id: str,
        state: Dict = None,
        external_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding a product object."""
        return self.affecting_object(
            ObjectType.PRODUCT,
            f"product-{product_id}",
            external_id=external_id or product_id,
            state_after=state,
            **metadata,
        )

    def affecting_customer(
        self,
        customer_id: str,
        state: Dict = None,
        external_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding a customer object."""
        return self.affecting_object(
            ObjectType.CUSTOMER,
            f"customer-{customer_id}",
            external_id=external_id or customer_id,
            state_after=state,
            **metadata,
        )

    def affecting_inventory(
        self,
        sku: str,
        quantity_before: int = None,
        quantity_after: int = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding an inventory object."""
        state_before = {"quantity": quantity_before} if quantity_before is not None else None
        state_after = {"quantity": quantity_after} if quantity_after is not None else None
        return self.affecting_object(
            ObjectType.INVENTORY,
            f"inventory-{sku}",
            external_id=sku,
            state_before=state_before,
            state_after=state_after,
            **metadata,
        )

    def affecting_payment(
        self,
        payment_id: str,
        state: Dict = None,
        external_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding a payment object."""
        return self.affecting_object(
            ObjectType.PAYMENT,
            f"payment-{payment_id}",
            external_id=external_id or payment_id,
            state_after=state,
            **metadata,
        )

    def affecting_shipment(
        self,
        shipment_id: str,
        state: Dict = None,
        external_id: str = None,
        **metadata
    ) -> "TraceBuilder":
        """Shortcut for adding a shipment object."""
        return self.affecting_object(
            ObjectType.SHIPMENT,
            f"shipment-{shipment_id}",
            external_id=external_id or shipment_id,
            state_after=state,
            **metadata,
        )

    # === Decision Methods ===

    def because(
        self,
        reasoning: str,
        action: str = None,
        context: Dict = None,
        constraints: List[str] = None,
        alternatives: List[Dict] = None,
        rejection_reasons: Dict[str, str] = None,
        **kwargs
    ) -> "TraceBuilder":
        """
        Add decision reasoning to this event.

        Args:
            reasoning: Why this decision was made
            action: What action was taken (defaults to event_type)
            context: Relevant context at decision time
            constraints: Business rules/constraints applied
            alternatives: Other options considered
            rejection_reasons: Why alternatives were rejected
        """
        if self._event.decision is None:
            self._event.decision = DecisionTrace()

        self._event.decision.reasoning = reasoning
        self._event.decision.action = action or self._event.event_type

        if context:
            self._event.decision.context = context
        if constraints:
            self._event.decision.constraints = constraints
        if alternatives:
            self._event.decision.alternatives = alternatives
        if rejection_reasons:
            self._event.decision.rejection_reasons = rejection_reasons

        # Handle additional kwargs
        for key, value in kwargs.items():
            if hasattr(self._event.decision, key):
                setattr(self._event.decision, key, value)

        return self

    def with_confidence(self, confidence: float) -> "TraceBuilder":
        """Set decision confidence (0.0 to 1.0)."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.confidence = confidence
        return self

    def with_risk(self, level: str) -> "TraceBuilder":
        """Set risk level ("low", "medium", "high")."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.risk_level = level
        return self

    def requires_approval(self, required: bool = True) -> "TraceBuilder":
        """Mark decision as requiring approval."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.requires_approval = required
        return self

    def approved_by(self, actor_id: str) -> "TraceBuilder":
        """Set who approved this decision."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.approved_by = actor_id
        return self

    def triggered_by(self, trigger: str, trigger_event_id: str = None) -> "TraceBuilder":
        """Set what triggered this decision."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.trigger = trigger
        self._event.decision.trigger_event_id = trigger_event_id
        return self

    def depends_on(self, *decision_ids: str) -> "TraceBuilder":
        """Set decision dependencies."""
        if self._event.decision is None:
            self._event.decision = DecisionTrace()
        self._event.decision.depends_on = list(decision_ids)
        return self

    # === Event Metadata Methods ===

    def with_outcome(
        self,
        outcome: EventOutcome,
        details: str = None,
        error: str = None
    ) -> "TraceBuilder":
        """Set the event outcome."""
        self._event.outcome = outcome
        self._event.outcome_details = details
        self._event.error = error
        return self

    def succeeded(self, details: str = None) -> "TraceBuilder":
        """Mark event as successful."""
        return self.with_outcome(EventOutcome.SUCCESS, details)

    def failed(self, error: str, details: str = None) -> "TraceBuilder":
        """Mark event as failed."""
        return self.with_outcome(EventOutcome.FAILURE, details, error)

    def partial(self, details: str = None) -> "TraceBuilder":
        """Mark event as partially completed."""
        return self.with_outcome(EventOutcome.PARTIAL, details)

    def pending(self, details: str = None) -> "TraceBuilder":
        """Mark event as pending."""
        return self.with_outcome(EventOutcome.PENDING, details)

    def with_duration(self, duration: Union[timedelta, float]) -> "TraceBuilder":
        """Set event duration (timedelta or seconds)."""
        if isinstance(duration, (int, float)):
            duration = timedelta(seconds=duration)
        self._event.duration = duration
        return self

    def with_tags(self, *tags: str) -> "TraceBuilder":
        """Add tags to the event."""
        self._event.tags.extend(tags)
        return self

    def with_data(self, **data) -> "TraceBuilder":
        """Add custom data fields."""
        self._event.data.update(data)
        return self

    def with_source(self, system: str, ip: str = None) -> "TraceBuilder":
        """Set the source system and IP."""
        self._event.source_system = system
        self._event.source_ip = ip
        return self

    def with_correlation(self, correlation_id: str) -> "TraceBuilder":
        """Set correlation ID for distributed tracing."""
        self._event.correlation_id = correlation_id
        return self

    def child_of(self, parent_event_id: str) -> "TraceBuilder":
        """Set parent event ID for hierarchical events."""
        self._event.parent_event_id = parent_event_id
        return self

    def at(self, timestamp: datetime) -> "TraceBuilder":
        """Set the event timestamp."""
        self._event.timestamp = timestamp
        return self

    # === Build and Record ===

    def build(self) -> TraceEvent:
        """Build the TraceEvent without recording it."""
        return self._event

    def record(self) -> str:
        """Record the event to the store and return its ID."""
        return self._client.store.save_event(self._event)
