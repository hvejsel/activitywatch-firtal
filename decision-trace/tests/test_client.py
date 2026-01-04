"""Tests for decision trace client."""

import pytest
import tempfile
import os
from datetime import datetime, timedelta

from decision_trace.client import DecisionTraceClient, TraceBuilder
from decision_trace.store import DecisionTraceStore
from decision_trace.models import (
    Actor,
    ActorType,
    ObjectType,
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
def client(temp_db):
    """Create a client with temporary database."""
    return DecisionTraceClient(db_path=temp_db)


class TestDecisionTraceClient:
    def test_trace_creates_builder(self, client):
        builder = client.trace("test.event", "Test description")

        assert isinstance(builder, TraceBuilder)
        assert builder._event.event_type == "test.event"
        assert builder._event.description == "Test description"

    def test_set_default_actor(self, client):
        default_actor = Actor.user("default-user", "Default User")
        client.set_default_actor(default_actor)

        builder = client.trace("test.event")

        assert builder._event.actor is not None
        assert builder._event.actor.id == "default-user"

    def test_query_delegates_to_store(self, client):
        # Record some events
        client.trace("event.1").record()
        client.trace("event.2").record()

        results = client.query(limit=10)

        assert len(results) == 2

    def test_get_event(self, client):
        event_id = client.trace("test.event", "Test").record()

        retrieved = client.get_event(event_id)

        assert retrieved is not None
        assert retrieved.event_type == "test.event"


class TestTraceBuilder:
    def test_by_user(self, client):
        event_id = (
            client.trace("test.event")
            .by_user("user-123", "John Doe", email="john@example.com", role="admin")
            .record()
        )

        event = client.get_event(event_id)

        assert event.actor.id == "user-123"
        assert event.actor.type == ActorType.USER
        assert event.actor.email == "john@example.com"
        assert event.actor.role == "admin"

    def test_by_ai(self, client):
        event_id = (
            client.trace("test.event")
            .by_ai("ai-123", "Test Bot", model="gpt-4", confidence=0.95)
            .record()
        )

        event = client.get_event(event_id)

        assert event.actor.id == "ai-123"
        assert event.actor.type == ActorType.AI_AGENT
        assert event.actor.model == "gpt-4"
        assert event.decision.confidence == 0.95

    def test_by_compute(self, client):
        event_id = (
            client.trace("test.event")
            .by_compute("job-123", "ETL Job", service_name="airflow", job_id="daily-etl")
            .record()
        )

        event = client.get_event(event_id)

        assert event.actor.id == "job-123"
        assert event.actor.type == ActorType.COMPUTE
        assert event.actor.service_name == "airflow"

    def test_by_system(self, client):
        event_id = (
            client.trace("test.event")
            .by_system("system-service")
            .record()
        )

        event = client.get_event(event_id)

        assert event.actor.type == ActorType.SYSTEM

    def test_affecting_order(self, client):
        event_id = (
            client.trace("order.created")
            .affecting_order("ord-123", {"total": 99.99, "status": "pending"})
            .record()
        )

        event = client.get_event(event_id)

        assert len(event.objects) == 1
        assert event.objects[0].type == ObjectType.ORDER
        assert event.objects[0].external_id == "ord-123"

    def test_affecting_product(self, client):
        event_id = (
            client.trace("product.updated")
            .affecting_product("SKU-123", {"price": 49.99})
            .record()
        )

        event = client.get_event(event_id)

        assert event.objects[0].type == ObjectType.PRODUCT

    def test_affecting_customer(self, client):
        event_id = (
            client.trace("customer.created")
            .affecting_customer("cust-123")
            .record()
        )

        event = client.get_event(event_id)

        assert event.objects[0].type == ObjectType.CUSTOMER

    def test_affecting_inventory(self, client):
        event_id = (
            client.trace("inventory.adjusted")
            .affecting_inventory("SKU-123", quantity_before=100, quantity_after=95)
            .record()
        )

        event = client.get_event(event_id)

        assert event.objects[0].type == ObjectType.INVENTORY
        assert event.objects[0].state_before["quantity"] == 100
        assert event.objects[0].state_after["quantity"] == 95

    def test_because_adds_decision(self, client):
        event_id = (
            client.trace("test.event")
            .because(
                "Test reasoning for the decision",
                action="test_action",
                context={"key": "value"},
                constraints=["constraint1", "constraint2"],
            )
            .record()
        )

        event = client.get_event(event_id)

        assert event.decision is not None
        assert event.decision.reasoning == "Test reasoning for the decision"
        assert event.decision.action == "test_action"
        assert event.decision.context["key"] == "value"
        assert len(event.decision.constraints) == 2

    def test_with_confidence(self, client):
        event_id = (
            client.trace("test.event")
            .with_confidence(0.85)
            .record()
        )

        event = client.get_event(event_id)

        assert event.decision.confidence == 0.85

    def test_with_risk(self, client):
        event_id = (
            client.trace("test.event")
            .with_risk("high")
            .record()
        )

        event = client.get_event(event_id)

        assert event.decision.risk_level == "high"

    def test_requires_approval(self, client):
        event_id = (
            client.trace("test.event")
            .requires_approval()
            .approved_by("manager-123")
            .record()
        )

        event = client.get_event(event_id)

        assert event.decision.requires_approval is True
        assert event.decision.approved_by == "manager-123"

    def test_triggered_by(self, client):
        event_id = (
            client.trace("test.event")
            .triggered_by("low_stock_alert", "event-123")
            .record()
        )

        event = client.get_event(event_id)

        assert event.decision.trigger == "low_stock_alert"
        assert event.decision.trigger_event_id == "event-123"

    def test_outcome_methods(self, client):
        success_id = client.trace("success.event").succeeded("All good").record()
        failed_id = client.trace("failed.event").failed("Something broke", "Error details").record()
        partial_id = client.trace("partial.event").partial("Half done").record()
        pending_id = client.trace("pending.event").pending("Waiting").record()

        success = client.get_event(success_id)
        failed = client.get_event(failed_id)
        partial = client.get_event(partial_id)
        pending = client.get_event(pending_id)

        assert success.outcome == EventOutcome.SUCCESS
        assert failed.outcome == EventOutcome.FAILURE
        assert failed.error == "Something broke"
        assert partial.outcome == EventOutcome.PARTIAL
        assert pending.outcome == EventOutcome.PENDING

    def test_with_duration(self, client):
        event_id = (
            client.trace("test.event")
            .with_duration(45.5)
            .record()
        )

        event = client.get_event(event_id)

        assert event.duration == timedelta(seconds=45.5)

    def test_with_tags(self, client):
        event_id = (
            client.trace("test.event")
            .with_tags("important", "review", "q4")
            .record()
        )

        event = client.get_event(event_id)

        assert set(event.tags) == {"important", "review", "q4"}

    def test_with_data(self, client):
        event_id = (
            client.trace("test.event")
            .with_data(custom_field="value", count=42)
            .record()
        )

        event = client.get_event(event_id)

        assert event.data["custom_field"] == "value"
        assert event.data["count"] == 42

    def test_with_source(self, client):
        event_id = (
            client.trace("test.event")
            .with_source("shopify", ip="192.168.1.100")
            .record()
        )

        event = client.get_event(event_id)

        assert event.source_system == "shopify"
        assert event.source_ip == "192.168.1.100"

    def test_with_correlation(self, client):
        event_id = (
            client.trace("test.event")
            .with_correlation("corr-12345")
            .record()
        )

        event = client.get_event(event_id)

        assert event.correlation_id == "corr-12345"

    def test_child_of(self, client):
        parent_id = client.trace("parent.event").record()
        child_id = (
            client.trace("child.event")
            .child_of(parent_id)
            .record()
        )

        child = client.get_event(child_id)

        assert child.parent_event_id == parent_id

    def test_at_timestamp(self, client):
        specific_time = datetime(2024, 1, 15, 10, 30, 0)
        event_id = (
            client.trace("test.event")
            .at(specific_time)
            .record()
        )

        event = client.get_event(event_id)

        assert event.timestamp == specific_time

    def test_build_without_record(self, client):
        builder = (
            client.trace("test.event", "Test description")
            .by_user("user-123", "John")
            .because("Test reason")
        )

        event = builder.build()

        assert event.event_type == "test.event"
        assert event.actor.id == "user-123"
        # Event should not be in database
        assert client.get_event(event.id) is None

    def test_fluent_chaining(self, client):
        """Test that all methods return the builder for chaining."""
        event_id = (
            client.trace("complex.event", "Complex event with all options")
            .by_user("user-123", "John Doe", email="john@example.com")
            .affecting_order("ord-456", {"total": 99.99})
            .affecting_customer("cust-789")
            .because(
                "Customer placed order after browsing",
                context={"session_duration": "10m"},
                constraints=["valid_payment"],
            )
            .with_confidence(0.99)
            .with_risk("low")
            .with_tags("order", "new-customer")
            .with_data(promo_code="SAVE10")
            .with_source("website")
            .with_correlation("session-abc")
            .succeeded("Order created successfully")
            .record()
        )

        event = client.get_event(event_id)

        assert event.event_type == "complex.event"
        assert event.actor.name == "John Doe"
        assert len(event.objects) == 2
        assert event.decision.reasoning == "Customer placed order after browsing"
        assert event.decision.confidence == 0.99
        assert "order" in event.tags
        assert event.data["promo_code"] == "SAVE10"
        assert event.outcome == EventOutcome.SUCCESS
