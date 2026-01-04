#!/usr/bin/env python3
"""
Basic Decision Tracing Example

Simple examples showing the core concepts of decision tracing.
"""

from datetime import datetime, timedelta
from decision_trace import (
    DecisionTraceClient,
    Actor,
    ActorType,
    DecisionTrace,
    TrackedObject,
    ObjectType,
    TraceEvent,
)


def main():
    # Initialize client (stores in ~/.local/share/decision-trace/traces.db)
    client = DecisionTraceClient()

    print("=== Basic Decision Tracing Examples ===\n")

    # --- Example 1: Simple user action ---
    print("1. Recording a simple user action...")

    event_id = (
        client.trace("document.created", "User created a new document")
        .by_user("user-123", "Alice", email="alice@company.com", role="editor")
        .with_data(document_name="Q4 Report", template="quarterly_report")
        .record()
    )
    print(f"   Event ID: {event_id}\n")

    # --- Example 2: Action with decision reasoning ---
    print("2. Recording an action with decision context...")

    event_id = (
        client.trace("task.assigned", "Task assigned to team member")
        .by_user("manager-456", "Bob Manager", role="team_lead")
        .affecting_object(
            ObjectType.CUSTOM,
            "task-789",
            name="Fix login bug",
            state_after={"status": "assigned", "assignee": "dev-111"},
        )
        .because(
            "Assigned based on current workload and expertise",
            context={
                "team_workload": {"dev-111": 3, "dev-222": 7, "dev-333": 5},
                "expertise_match": {"dev-111": 0.9, "dev-222": 0.7, "dev-333": 0.6},
            },
            alternatives=[
                {"assignee": "dev-222", "reason": "More experience but overloaded"},
                {"assignee": "dev-333", "reason": "Available but less expertise"},
            ],
            rejection_reasons={
                "dev-222": "Current workload too high (7 tasks)",
                "dev-333": "Lower expertise match (0.6 vs 0.9)",
            },
        )
        .record()
    )
    print(f"   Event ID: {event_id}\n")

    # --- Example 3: AI/automated decision ---
    print("3. Recording an AI decision...")

    event_id = (
        client.trace("email.categorized", "Email automatically categorized")
        .by_ai("email-classifier", "Email Classifier AI", model="bert-classifier-v2")
        .affecting_object(
            ObjectType.EMAIL,
            "email-abc123",
            external_id="msg-12345@mail.company.com",
            state_after={"category": "urgent", "priority": "high"},
        )
        .because(
            "Classified as urgent based on content analysis",
            context={
                "keywords_found": ["deadline", "ASAP", "critical"],
                "sender_priority": "vip",
                "historical_urgency_rate": 0.85,
            },
        )
        .with_confidence(0.94)
        .with_tags("email", "classification", "urgent")
        .record()
    )
    print(f"   Event ID: {event_id}\n")

    # --- Example 4: Compute engine action ---
    print("4. Recording a scheduled job action...")

    event_id = (
        client.trace("report.generated", "Daily sales report generated")
        .by_compute(
            "report-generator",
            "Daily Report Generator",
            service_name="cron-service",
            job_id="daily-sales-report-001",
        )
        .affecting_object(
            ObjectType.REPORT,
            "report-20240115",
            name="Daily Sales Report - Jan 15, 2024",
            state_after={"status": "generated", "row_count": 1523},
        )
        .triggered_by("scheduled_cron", trigger_event_id=None)
        .with_duration(timedelta(seconds=45))
        .succeeded("Report generated with 1523 rows")
        .record()
    )
    print(f"   Event ID: {event_id}\n")

    # --- Example 5: Using span for duration tracking ---
    print("5. Using span for automatic duration tracking...")

    with client.span("data.processing", "Processing large dataset") as trace:
        trace.by_compute("etl-pipeline", "ETL Pipeline", service_name="data-team")
        trace.affecting_object(ObjectType.CUSTOM, "dataset-xyz", name="Customer Analytics")
        trace.because("Scheduled daily ETL run")

        # Simulate work
        import time
        time.sleep(0.5)

    print("   Span completed (duration auto-calculated)\n")

    # --- Example 6: Hierarchical events ---
    print("6. Creating parent-child event relationships...")

    # Parent event
    parent_id = (
        client.trace("workflow.started", "Onboarding workflow started")
        .by_system("workflow-engine")
        .affecting_object(ObjectType.CUSTOM, "workflow-123", name="New Employee Onboarding")
        .record()
    )

    # Child events
    for step in ["account_created", "permissions_granted", "welcome_email_sent"]:
        client.trace(f"workflow.step.{step}", f"Completed: {step}") \
            .by_system("workflow-engine") \
            .child_of(parent_id) \
            .record()

    print(f"   Parent workflow: {parent_id}")
    print("   Created 3 child events\n")

    # --- Querying examples ---
    print("=== Querying Events ===\n")

    # Get recent events
    print("Recent events:")
    events = client.query(limit=5)
    for evt in events:
        print(f"  [{evt.event_type}] {evt.description}")
        if evt.actor:
            print(f"    Actor: {evt.actor.name} ({evt.actor.type.value})")
        if evt.decision and evt.decision.reasoning:
            print(f"    Reason: {evt.decision.reasoning[:60]}...")

    # Search by reasoning
    print("\nSearching for 'workload' in decisions:")
    results = client.search("workload")
    for evt in results:
        print(f"  [{evt.event_type}] {evt.decision.reasoning[:60]}...")

    # Get stats
    print("\nDatabase statistics:")
    stats = client.stats()
    print(f"  Total events: {stats['total_events']}")
    print(f"  Total actors: {stats['total_actors']}")
    print(f"  Total decisions: {stats['total_decisions']}")

    print("\n=== Examples Complete ===")


if __name__ == "__main__":
    main()
