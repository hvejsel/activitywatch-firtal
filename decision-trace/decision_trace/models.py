"""
Core data models for Decision Tracing.

These models extend the ActivityWatch event concept to support:
- Actor tracking (who performed the action)
- Decision reasoning (why it was done)
- Object relationships (what entities are connected)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from uuid import uuid4
import json


class ActorType(Enum):
    """Types of actors that can perform actions."""
    USER = "user"           # Human user
    AI_AGENT = "ai_agent"   # AI/LLM agent
    COMPUTE = "compute"     # Automated compute engine/script
    SYSTEM = "system"       # System-level automated action
    EXTERNAL = "external"   # External service/API


class ObjectType(Enum):
    """Types of ecommerce objects that can be tracked."""
    # Core ecommerce objects
    ORDER = "order"
    PRODUCT = "product"
    CUSTOMER = "customer"
    INVENTORY = "inventory"
    CART = "cart"
    PAYMENT = "payment"
    SHIPMENT = "shipment"
    RETURN = "return"
    REFUND = "refund"

    # Marketing & engagement
    CAMPAIGN = "campaign"
    PROMOTION = "promotion"
    COUPON = "coupon"
    EMAIL = "email"
    NOTIFICATION = "notification"

    # Operational
    SUPPLIER = "supplier"
    WAREHOUSE = "warehouse"
    CATEGORY = "category"
    PRICE = "price"

    # Analytics
    REPORT = "report"
    FORECAST = "forecast"

    # Custom
    CUSTOM = "custom"


class EventOutcome(Enum):
    """Possible outcomes of a traced event."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"
    PENDING = "pending"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


@dataclass
class Actor:
    """
    Represents an entity that performs actions.

    Can be a human user, AI agent, or automated system.
    """
    id: str
    type: ActorType
    name: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    # For AI agents
    model: Optional[str] = None  # e.g., "gpt-4", "claude-3"
    version: Optional[str] = None

    # For users
    email: Optional[str] = None
    role: Optional[str] = None  # e.g., "admin", "support", "warehouse"

    # For compute engines
    service_name: Optional[str] = None
    job_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        result = {
            "id": self.id,
            "type": self.type.value,
            "name": self.name,
            "metadata": self.metadata,
        }
        if self.model:
            result["model"] = self.model
        if self.version:
            result["version"] = self.version
        if self.email:
            result["email"] = self.email
        if self.role:
            result["role"] = self.role
        if self.service_name:
            result["service_name"] = self.service_name
        if self.job_id:
            result["job_id"] = self.job_id
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Actor":
        """Create Actor from dictionary."""
        return cls(
            id=data["id"],
            type=ActorType(data["type"]),
            name=data["name"],
            metadata=data.get("metadata", {}),
            model=data.get("model"),
            version=data.get("version"),
            email=data.get("email"),
            role=data.get("role"),
            service_name=data.get("service_name"),
            job_id=data.get("job_id"),
        )

    @classmethod
    def user(cls, id: str, name: str, email: str = None, role: str = None, **metadata) -> "Actor":
        """Factory method for creating a user actor."""
        return cls(
            id=id,
            type=ActorType.USER,
            name=name,
            email=email,
            role=role,
            metadata=metadata,
        )

    @classmethod
    def ai_agent(cls, id: str, name: str, model: str, version: str = None, **metadata) -> "Actor":
        """Factory method for creating an AI agent actor."""
        return cls(
            id=id,
            type=ActorType.AI_AGENT,
            name=name,
            model=model,
            version=version,
            metadata=metadata,
        )

    @classmethod
    def compute(cls, id: str, name: str, service_name: str, job_id: str = None, **metadata) -> "Actor":
        """Factory method for creating a compute engine actor."""
        return cls(
            id=id,
            type=ActorType.COMPUTE,
            name=name,
            service_name=service_name,
            job_id=job_id,
            metadata=metadata,
        )


@dataclass
class TrackedObject:
    """
    Represents an ecommerce entity being tracked.

    Links events to specific business objects like orders, products, customers.
    """
    id: str
    type: ObjectType
    external_id: Optional[str] = None  # ID in your ecommerce system
    name: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # State tracking
    state_before: Optional[Dict[str, Any]] = None
    state_after: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        result = {
            "id": self.id,
            "type": self.type.value,
            "metadata": self.metadata,
        }
        if self.external_id:
            result["external_id"] = self.external_id
        if self.name:
            result["name"] = self.name
        if self.state_before:
            result["state_before"] = self.state_before
        if self.state_after:
            result["state_after"] = self.state_after
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrackedObject":
        """Create TrackedObject from dictionary."""
        return cls(
            id=data["id"],
            type=ObjectType(data["type"]),
            external_id=data.get("external_id"),
            name=data.get("name"),
            metadata=data.get("metadata", {}),
            state_before=data.get("state_before"),
            state_after=data.get("state_after"),
        )


@dataclass
class DecisionTrace:
    """
    Captures the reasoning behind an action.

    This is the core of decision tracing - understanding WHY something happened.
    """
    id: str = field(default_factory=lambda: str(uuid4()))

    # The decision itself
    action: str = ""  # What action was taken (e.g., "approve_refund", "restock_item")
    reasoning: str = ""  # Why this decision was made

    # Context
    context: Dict[str, Any] = field(default_factory=dict)  # Relevant context at decision time
    constraints: List[str] = field(default_factory=list)  # Business rules/constraints applied

    # Alternatives considered
    alternatives: List[Dict[str, Any]] = field(default_factory=list)  # Other options considered
    rejection_reasons: Dict[str, str] = field(default_factory=dict)  # Why alternatives were rejected

    # Confidence & risk
    confidence: Optional[float] = None  # 0.0 to 1.0, for AI decisions
    risk_level: Optional[str] = None  # "low", "medium", "high"
    requires_approval: bool = False
    approved_by: Optional[str] = None  # Actor ID who approved

    # Triggers
    trigger: Optional[str] = None  # What triggered this decision
    trigger_event_id: Optional[str] = None  # ID of triggering event

    # Dependencies
    depends_on: List[str] = field(default_factory=list)  # IDs of related decisions

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "action": self.action,
            "reasoning": self.reasoning,
            "context": self.context,
            "constraints": self.constraints,
            "alternatives": self.alternatives,
            "rejection_reasons": self.rejection_reasons,
            "confidence": self.confidence,
            "risk_level": self.risk_level,
            "requires_approval": self.requires_approval,
            "approved_by": self.approved_by,
            "trigger": self.trigger,
            "trigger_event_id": self.trigger_event_id,
            "depends_on": self.depends_on,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionTrace":
        """Create DecisionTrace from dictionary."""
        return cls(
            id=data.get("id", str(uuid4())),
            action=data.get("action", ""),
            reasoning=data.get("reasoning", ""),
            context=data.get("context", {}),
            constraints=data.get("constraints", []),
            alternatives=data.get("alternatives", []),
            rejection_reasons=data.get("rejection_reasons", {}),
            confidence=data.get("confidence"),
            risk_level=data.get("risk_level"),
            requires_approval=data.get("requires_approval", False),
            approved_by=data.get("approved_by"),
            trigger=data.get("trigger"),
            trigger_event_id=data.get("trigger_event_id"),
            depends_on=data.get("depends_on", []),
        )


@dataclass
class TraceEvent:
    """
    A complete traced event combining:
    - What happened (the event)
    - Who did it (the actor)
    - Why it was done (the decision)
    - What objects were affected (tracked objects)

    This extends the ActivityWatch Event model for decision tracing.
    """
    id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    duration: timedelta = field(default_factory=lambda: timedelta(seconds=0))

    # Core event data
    event_type: str = ""  # e.g., "order.created", "inventory.adjusted", "refund.approved"
    description: str = ""

    # The actor who performed this action
    actor: Optional[Actor] = None

    # The decision behind this action
    decision: Optional[DecisionTrace] = None

    # Objects affected by this action
    objects: List[TrackedObject] = field(default_factory=list)

    # Outcome
    outcome: EventOutcome = EventOutcome.SUCCESS
    outcome_details: Optional[str] = None
    error: Optional[str] = None

    # Additional data
    data: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

    # Linking
    parent_event_id: Optional[str] = None  # For hierarchical events
    correlation_id: Optional[str] = None  # For tracing across systems

    # Source tracking
    source_system: Optional[str] = None  # e.g., "shopify", "warehouse-api"
    source_ip: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization (ActivityWatch compatible)."""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "duration": self.duration.total_seconds(),
            "data": {
                "event_type": self.event_type,
                "description": self.description,
                "actor": self.actor.to_dict() if self.actor else None,
                "decision": self.decision.to_dict() if self.decision else None,
                "objects": [obj.to_dict() for obj in self.objects],
                "outcome": self.outcome.value,
                "outcome_details": self.outcome_details,
                "error": self.error,
                "tags": self.tags,
                "parent_event_id": self.parent_event_id,
                "correlation_id": self.correlation_id,
                "source_system": self.source_system,
                "source_ip": self.source_ip,
                **self.data,
            },
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TraceEvent":
        """Create TraceEvent from dictionary."""
        event_data = data.get("data", {})
        return cls(
            id=data.get("id", str(uuid4())),
            timestamp=datetime.fromisoformat(data["timestamp"]) if isinstance(data.get("timestamp"), str) else data.get("timestamp", datetime.utcnow()),
            duration=timedelta(seconds=data.get("duration", 0)),
            event_type=event_data.get("event_type", ""),
            description=event_data.get("description", ""),
            actor=Actor.from_dict(event_data["actor"]) if event_data.get("actor") else None,
            decision=DecisionTrace.from_dict(event_data["decision"]) if event_data.get("decision") else None,
            objects=[TrackedObject.from_dict(obj) for obj in event_data.get("objects", [])],
            outcome=EventOutcome(event_data.get("outcome", "success")),
            outcome_details=event_data.get("outcome_details"),
            error=event_data.get("error"),
            tags=event_data.get("tags", []),
            parent_event_id=event_data.get("parent_event_id"),
            correlation_id=event_data.get("correlation_id"),
            source_system=event_data.get("source_system"),
            source_ip=event_data.get("source_ip"),
            data={k: v for k, v in event_data.items() if k not in [
                "event_type", "description", "actor", "decision", "objects",
                "outcome", "outcome_details", "error", "tags", "parent_event_id",
                "correlation_id", "source_system", "source_ip"
            ]},
        )

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), default=str)

    def add_object(self, obj: TrackedObject) -> "TraceEvent":
        """Add a tracked object to this event."""
        self.objects.append(obj)
        return self

    def with_decision(
        self,
        action: str,
        reasoning: str,
        context: Dict[str, Any] = None,
        **kwargs
    ) -> "TraceEvent":
        """Fluent API to add decision trace."""
        self.decision = DecisionTrace(
            action=action,
            reasoning=reasoning,
            context=context or {},
            **kwargs,
        )
        return self
