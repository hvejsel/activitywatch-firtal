"""Tests for decision trace store."""

import pytest
import tempfile
import os
from datetime import datetime, timedelta

from decision_trace.store import DecisionTraceStore
from decision_trace.models import (
    Actor,
    ActorType,
    DecisionTrace,
    TrackedObject,
    ObjectType,
    TraceEvent,
    EventOutcome,
)


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def store(temp_db):
    """Create a store with temporary database."""
    return DecisionTraceStore(db_path=temp_db)


class TestDecisionTraceStore:
    def test_save_and_get_event(self, store):
        event = TraceEvent(
            event_type="test.event",
            description="Test event description",
        )

        event_id = store.save_event(event)
        retrieved = store.get_event(event_id)

        assert retrieved is not None
        assert retrieved.id == event.id
        assert retrieved.event_type == "test.event"
        assert retrieved.description == "Test event description"

    def test_save_event_with_actor(self, store):
        event = TraceEvent(
            event_type="test.event",
            actor=Actor.user("user-123", "John Doe", email="john@example.com"),
        )

        event_id = store.save_event(event)
        retrieved = store.get_event(event_id)

        assert retrieved.actor is not None
        assert retrieved.actor.id == "user-123"
        assert retrieved.actor.name == "John Doe"
        assert retrieved.actor.type == ActorType.USER

    def test_save_event_with_decision(self, store):
        event = TraceEvent(
            event_type="test.event",
            decision=DecisionTrace(
                action="test_action",
                reasoning="Test reasoning for the decision",
                confidence=0.85,
                risk_level="low",
            ),
        )

        event_id = store.save_event(event)
        retrieved = store.get_event(event_id)

        assert retrieved.decision is not None
        assert retrieved.decision.action == "test_action"
        assert retrieved.decision.reasoning == "Test reasoning for the decision"
        assert retrieved.decision.confidence == 0.85
        assert retrieved.decision.risk_level == "low"

    def test_save_event_with_objects(self, store):
        event = TraceEvent(event_type="test.event")
        event.add_object(TrackedObject(
            id="order-123",
            type=ObjectType.ORDER,
            external_id="ORD-001",
        ))
        event.add_object(TrackedObject(
            id="customer-456",
            type=ObjectType.CUSTOMER,
        ))

        event_id = store.save_event(event)
        retrieved = store.get_event(event_id)

        assert len(retrieved.objects) == 2
        assert retrieved.objects[0].type == ObjectType.ORDER
        assert retrieved.objects[1].type == ObjectType.CUSTOMER

    def test_save_event_with_tags(self, store):
        event = TraceEvent(
            event_type="test.event",
            tags=["important", "review", "q4"],
        )

        event_id = store.save_event(event)
        retrieved = store.get_event(event_id)

        assert set(retrieved.tags) == {"important", "review", "q4"}

    def test_query_by_event_type(self, store):
        # Create events of different types
        store.save_event(TraceEvent(event_type="order.created"))
        store.save_event(TraceEvent(event_type="order.created"))
        store.save_event(TraceEvent(event_type="payment.captured"))

        results = store.query_events(event_types=["order.created"])

        assert len(results) == 2
        assert all(e.event_type == "order.created" for e in results)

    def test_query_by_time_range(self, store):
        now = datetime.utcnow()

        # Create events at different times
        store.save_event(TraceEvent(
            event_type="old.event",
            timestamp=now - timedelta(days=10),
        ))
        store.save_event(TraceEvent(
            event_type="recent.event",
            timestamp=now - timedelta(hours=1),
        ))
        store.save_event(TraceEvent(
            event_type="very.recent.event",
            timestamp=now,
        ))

        results = store.query_events(
            start=now - timedelta(days=1),
            end=now + timedelta(hours=1),
        )

        assert len(results) == 2
        assert "old.event" not in [e.event_type for e in results]

    def test_query_by_actor_type(self, store):
        store.save_event(TraceEvent(
            event_type="user.action",
            actor=Actor.user("user-1", "John"),
        ))
        store.save_event(TraceEvent(
            event_type="ai.action",
            actor=Actor.ai_agent("ai-1", "Bot", model="gpt-4"),
        ))
        store.save_event(TraceEvent(
            event_type="another.user.action",
            actor=Actor.user("user-2", "Jane"),
        ))

        results = store.query_events(actor_types=[ActorType.USER])

        assert len(results) == 2
        assert all(e.actor.type == ActorType.USER for e in results)

    def test_query_by_correlation_id(self, store):
        correlation_id = "corr-12345"

        store.save_event(TraceEvent(
            event_type="step.1",
            correlation_id=correlation_id,
        ))
        store.save_event(TraceEvent(
            event_type="step.2",
            correlation_id=correlation_id,
        ))
        store.save_event(TraceEvent(
            event_type="unrelated",
            correlation_id="other-corr",
        ))

        results = store.query_events(correlation_id=correlation_id)

        assert len(results) == 2
        assert all(e.correlation_id == correlation_id for e in results)

    def test_search_decisions(self, store):
        store.save_event(TraceEvent(
            event_type="pricing.change",
            decision=DecisionTrace(
                action="increase_price",
                reasoning="Increased price due to high demand and low inventory",
            ),
        ))
        store.save_event(TraceEvent(
            event_type="inventory.restock",
            decision=DecisionTrace(
                action="restock",
                reasoning="Restocking due to low inventory levels",
            ),
        ))
        store.save_event(TraceEvent(
            event_type="other.action",
            decision=DecisionTrace(
                action="other",
                reasoning="Unrelated decision reasoning",
            ),
        ))

        results = store.search_decisions("inventory")

        assert len(results) >= 1
        assert any("inventory" in e.decision.reasoning.lower() for e in results)

    def test_get_object_history(self, store):
        # Create events affecting the same object
        for i in range(3):
            event = TraceEvent(event_type=f"order.update.{i}")
            event.add_object(TrackedObject(
                id="order-123",
                type=ObjectType.ORDER,
                external_id="ORD-001",
            ))
            store.save_event(event)

        # Create event for different object
        other_event = TraceEvent(event_type="other.order")
        other_event.add_object(TrackedObject(
            id="order-456",
            type=ObjectType.ORDER,
        ))
        store.save_event(other_event)

        history = store.get_object_history(object_id="order-123")

        assert len(history) == 3

    def test_get_actor_activity(self, store):
        actor_id = "user-123"

        # Create events by the same actor
        for i in range(3):
            store.save_event(TraceEvent(
                event_type=f"action.{i}",
                actor=Actor.user(actor_id, "John"),
            ))

        # Create event by different actor
        store.save_event(TraceEvent(
            event_type="other.action",
            actor=Actor.user("user-456", "Jane"),
        ))

        activity = store.get_actor_activity(actor_id)

        assert len(activity) == 3
        assert all(e.actor.id == actor_id for e in activity)

    def test_get_event_chain(self, store):
        # Create parent event
        parent = TraceEvent(event_type="workflow.start")
        parent_id = store.save_event(parent)

        # Create child events
        child1 = TraceEvent(event_type="step.1", parent_event_id=parent_id)
        child1_id = store.save_event(child1)

        child2 = TraceEvent(event_type="step.2", parent_event_id=parent_id)
        store.save_event(child2)

        # Create grandchild
        grandchild = TraceEvent(event_type="substep.1", parent_event_id=child1_id)
        store.save_event(grandchild)

        chain = store.get_event_chain(parent_id)

        assert len(chain) == 4
        assert chain[0].event_type == "workflow.start"

    def test_get_stats(self, store):
        # Create some events
        store.save_event(TraceEvent(
            event_type="order.created",
            actor=Actor.user("user-1", "John"),
            decision=DecisionTrace(action="create", reasoning="test"),
        ))
        store.save_event(TraceEvent(
            event_type="order.created",
            actor=Actor.ai_agent("ai-1", "Bot", model="gpt-4"),
        ))

        stats = store.get_stats()

        assert stats["total_events"] == 2
        assert stats["total_actors"] == 2
        assert stats["total_decisions"] == 1
        assert "order.created" in stats["top_event_types"]
