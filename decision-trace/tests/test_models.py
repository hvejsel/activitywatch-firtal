"""Tests for decision trace models."""

import pytest
from datetime import datetime, timedelta

from decision_trace.models import (
    Actor,
    ActorType,
    DecisionTrace,
    TrackedObject,
    ObjectType,
    TraceEvent,
    EventOutcome,
)


class TestActor:
    def test_user_factory(self):
        actor = Actor.user("user-123", "John Doe", email="john@example.com", role="admin")

        assert actor.id == "user-123"
        assert actor.type == ActorType.USER
        assert actor.name == "John Doe"
        assert actor.email == "john@example.com"
        assert actor.role == "admin"

    def test_ai_agent_factory(self):
        actor = Actor.ai_agent("ai-123", "Price Bot", model="gpt-4", version="1.0")

        assert actor.id == "ai-123"
        assert actor.type == ActorType.AI_AGENT
        assert actor.name == "Price Bot"
        assert actor.model == "gpt-4"
        assert actor.version == "1.0"

    def test_compute_factory(self):
        actor = Actor.compute("job-123", "ETL Pipeline", service_name="airflow", job_id="daily-etl")

        assert actor.id == "job-123"
        assert actor.type == ActorType.COMPUTE
        assert actor.service_name == "airflow"
        assert actor.job_id == "daily-etl"

    def test_to_dict_from_dict_roundtrip(self):
        original = Actor.user("user-123", "John Doe", email="john@example.com")
        data = original.to_dict()
        restored = Actor.from_dict(data)

        assert restored.id == original.id
        assert restored.type == original.type
        assert restored.name == original.name
        assert restored.email == original.email


class TestDecisionTrace:
    def test_basic_decision(self):
        decision = DecisionTrace(
            action="approve_refund",
            reasoning="Customer is a VIP with valid complaint",
            context={"customer_tier": "gold", "complaint_valid": True},
        )

        assert decision.action == "approve_refund"
        assert decision.reasoning == "Customer is a VIP with valid complaint"
        assert decision.context["customer_tier"] == "gold"

    def test_decision_with_alternatives(self):
        decision = DecisionTrace(
            action="full_refund",
            reasoning="Product defect confirmed",
            alternatives=[
                {"action": "partial_refund", "amount": 50},
                {"action": "replacement", "sku": "NEW-SKU"},
            ],
            rejection_reasons={
                "partial_refund": "Defect was severe",
                "replacement": "Customer requested refund",
            },
        )

        assert len(decision.alternatives) == 2
        assert "partial_refund" in decision.rejection_reasons

    def test_to_dict_from_dict_roundtrip(self):
        original = DecisionTrace(
            action="test_action",
            reasoning="test reasoning",
            confidence=0.95,
            risk_level="low",
        )
        data = original.to_dict()
        restored = DecisionTrace.from_dict(data)

        assert restored.action == original.action
        assert restored.reasoning == original.reasoning
        assert restored.confidence == original.confidence
        assert restored.risk_level == original.risk_level


class TestTrackedObject:
    def test_basic_object(self):
        obj = TrackedObject(
            id="order-123",
            type=ObjectType.ORDER,
            external_id="ORD-2024-001",
            name="Customer Order",
        )

        assert obj.id == "order-123"
        assert obj.type == ObjectType.ORDER
        assert obj.external_id == "ORD-2024-001"

    def test_object_with_state(self):
        obj = TrackedObject(
            id="inventory-sku",
            type=ObjectType.INVENTORY,
            state_before={"quantity": 100},
            state_after={"quantity": 95},
        )

        assert obj.state_before["quantity"] == 100
        assert obj.state_after["quantity"] == 95


class TestTraceEvent:
    def test_basic_event(self):
        event = TraceEvent(
            event_type="order.created",
            description="New order placed",
        )

        assert event.event_type == "order.created"
        assert event.description == "New order placed"
        assert event.outcome == EventOutcome.SUCCESS  # default

    def test_event_with_actor(self):
        actor = Actor.user("user-123", "John")
        event = TraceEvent(
            event_type="order.created",
            actor=actor,
        )

        assert event.actor.id == "user-123"
        assert event.actor.type == ActorType.USER

    def test_event_with_decision(self):
        decision = DecisionTrace(action="create", reasoning="Customer checkout")
        event = TraceEvent(
            event_type="order.created",
            decision=decision,
        )

        assert event.decision.action == "create"
        assert event.decision.reasoning == "Customer checkout"

    def test_event_with_objects(self):
        event = TraceEvent(event_type="order.created")
        event.add_object(TrackedObject(id="order-1", type=ObjectType.ORDER))
        event.add_object(TrackedObject(id="customer-1", type=ObjectType.CUSTOMER))

        assert len(event.objects) == 2
        assert event.objects[0].type == ObjectType.ORDER
        assert event.objects[1].type == ObjectType.CUSTOMER

    def test_fluent_with_decision(self):
        event = TraceEvent(event_type="test").with_decision(
            action="test_action",
            reasoning="test reasoning",
            context={"key": "value"},
        )

        assert event.decision.action == "test_action"
        assert event.decision.reasoning == "test reasoning"
        assert event.decision.context["key"] == "value"

    def test_to_dict_roundtrip(self):
        original = TraceEvent(
            event_type="order.created",
            description="Test order",
            actor=Actor.user("user-1", "John"),
            decision=DecisionTrace(action="create", reasoning="test"),
            outcome=EventOutcome.SUCCESS,
            tags=["test", "order"],
        )
        original.add_object(TrackedObject(id="order-1", type=ObjectType.ORDER))

        data = original.to_dict()
        restored = TraceEvent.from_dict(data)

        assert restored.event_type == original.event_type
        assert restored.description == original.description
        assert restored.actor.id == original.actor.id
        assert restored.decision.action == original.decision.action
        assert restored.outcome == original.outcome
        assert restored.tags == original.tags
        assert len(restored.objects) == 1
