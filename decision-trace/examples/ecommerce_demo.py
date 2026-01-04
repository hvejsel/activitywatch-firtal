#!/usr/bin/env python3
"""
Ecommerce Decision Tracing Demo

This example demonstrates how to use the Decision Trace library to track
various ecommerce operations with full decision context.
"""

from datetime import datetime, timedelta
from decision_trace import DecisionTraceClient, Actor, ActorType
from decision_trace.ecommerce import EcommerceClient, EcommerceEventType
from decision_trace.models import ObjectType, TrackedObject


def main():
    # Initialize the client (uses SQLite by default)
    client = EcommerceClient()

    print("=== Ecommerce Decision Tracing Demo ===\n")

    # --- Scenario 1: Customer places an order ---
    print("1. Customer places an order...")

    customer_id = "cust-12345"
    order_id = "ord-98765"

    # Record customer creating an order
    event_id = (
        client.order_created(
            order_id=order_id,
            customer_id=customer_id,
            total=149.99,
            items=[
                {"sku": "WIDGET-001", "qty": 2, "price": 49.99},
                {"sku": "GADGET-002", "qty": 1, "price": 50.01},
            ],
            shipping_method="standard",
            payment_method="credit_card",
        )
        .by_user(customer_id, "John Smith", email="john@example.com", role="customer")
        .because(
            "Customer completed checkout after adding items to cart",
            context={
                "cart_session": "sess-abc123",
                "time_in_checkout": "3m 42s",
                "applied_coupon": None,
            },
        )
        .with_source("website", ip="192.168.1.100")
        .record()
    )
    print(f"   Created order event: {event_id}")

    # --- Scenario 2: Payment processing ---
    print("2. Processing payment...")

    payment_id = "pay-55555"
    payment_event = (
        client.payment_captured(
            payment_id=payment_id,
            order_id=order_id,
            amount=149.99,
            payment_method="visa",
            processor="stripe",
        )
        .by_system("payment-service")
        .because(
            "Payment authorized and captured successfully",
            context={
                "authorization_code": "AUTH123",
                "fraud_score": 0.12,
                "fraud_threshold": 0.7,
            },
        )
        .record()
    )
    print(f"   Payment captured: {payment_event}")

    # --- Scenario 3: AI Fraud Check ---
    print("3. AI performs fraud check...")

    fraud_check = (
        client.trace(EcommerceEventType.ORDER_FRAUD_CLEARED, f"Order {order_id} cleared by fraud detection")
        .by_ai("fraud-ai-v2", "Fraud Detection AI", model="fraud-detector-v2.1", version="2.1.0")
        .affecting_order(order_id)
        .because(
            "Order cleared after fraud analysis",
            context={
                "fraud_score": 0.12,
                "risk_factors": {
                    "new_customer": False,
                    "high_value": False,
                    "unusual_location": False,
                    "velocity_check": "pass",
                },
                "similar_fraudulent_orders": 0,
            },
            alternatives=[
                {"action": "flag_for_review", "score_threshold": 0.5},
                {"action": "auto_reject", "score_threshold": 0.8},
            ],
            rejection_reasons={
                "flag_for_review": "Score 0.12 is below 0.5 threshold",
                "auto_reject": "Score 0.12 is far below 0.8 threshold",
            },
        )
        .with_confidence(0.88)
        .with_risk("low")
        .with_tags("fraud", "ai", "cleared")
        .record()
    )
    print(f"   Fraud check completed: {fraud_check}")

    # --- Scenario 4: Inventory reservation ---
    print("4. Reserving inventory...")

    for item in [("WIDGET-001", 2, 50, 48), ("GADGET-002", 1, 25, 24)]:
        sku, qty, before, after = item
        inv_event = (
            client.inventory_adjusted(
                sku=sku,
                quantity_before=before,
                quantity_after=after,
                reason=f"Reserved for order {order_id}",
                location="warehouse-east",
            )
            .by_system("inventory-service")
            .with_correlation(order_id)
            .with_tags("reservation")
            .record()
        )
        print(f"   Reserved {qty}x {sku}: {inv_event}")

    # --- Scenario 5: Low stock triggers AI restock recommendation ---
    print("5. AI detects low stock and recommends restock...")

    # Low stock alert
    low_stock = (
        client.inventory_low_stock(
            sku="GADGET-002",
            current_quantity=24,
            threshold=30,
            recommended_action="reorder_50_units",
        )
        .by_compute("inventory-monitor", "Inventory Monitor", service_name="cron-jobs", job_id="inv-check-001")
        .record()
    )
    print(f"   Low stock alert: {low_stock}")

    # AI recommendation for restock
    restock_rec = (
        client.ai_recommendation(
            recommendation_type="inventory_restock",
            recommendation={
                "sku": "GADGET-002",
                "recommended_quantity": 100,
                "suggested_supplier": "supplier-acme",
                "urgency": "medium",
                "estimated_stockout_date": (datetime.utcnow() + timedelta(days=14)).isoformat(),
            },
            context={
                "current_stock": 24,
                "avg_daily_sales": 2.3,
                "lead_time_days": 7,
                "safety_stock": 10,
                "historical_demand": [2, 3, 2, 1, 4, 2, 3],
            },
            confidence=0.91,
            model="demand-forecast-v3",
            affected_objects=[
                TrackedObject(
                    id="inventory-GADGET-002",
                    type=ObjectType.INVENTORY,
                    external_id="GADGET-002",
                ),
            ],
        )
        .triggered_by("low_stock_alert", low_stock)
        .record()
    )
    print(f"   AI restock recommendation: {restock_rec}")

    # --- Scenario 6: Warehouse worker fulfills order ---
    print("6. Warehouse fulfillment...")

    # Create shipment
    shipment_id = "ship-77777"
    shipment = (
        client.shipment_created(
            shipment_id=shipment_id,
            order_id=order_id,
            carrier="ups",
            tracking_number="1Z999AA10123456784",
            items=["WIDGET-001", "GADGET-002"],
        )
        .by_user("emp-456", "Jane Warehouse", role="warehouse_associate")
        .because(
            "Order picked and packed, ready for shipment",
            context={
                "pick_time": "4m 32s",
                "pack_time": "2m 15s",
                "bin_locations": ["A-12-3", "B-05-1"],
            },
        )
        .with_correlation(order_id)
        .record()
    )
    print(f"   Shipment created: {shipment}")

    # Ship it
    shipped = (
        client.shipment_shipped(
            shipment_id=shipment_id,
            order_id=order_id,
            tracking_number="1Z999AA10123456784",
            carrier="ups",
            estimated_delivery=datetime.utcnow() + timedelta(days=3),
        )
        .by_user("emp-456", "Jane Warehouse", role="warehouse_associate")
        .child_of(shipment)
        .record()
    )
    print(f"   Shipment shipped: {shipped}")

    # --- Scenario 7: Dynamic pricing adjustment ---
    print("7. AI adjusts pricing based on demand...")

    pricing = (
        client.dynamic_price_adjusted(
            product_id="WIDGET-001",
            old_price=49.99,
            new_price=54.99,
            factors={
                "demand_index": 1.23,
                "competitor_price": 59.99,
                "inventory_level": "low",
                "seasonality_factor": 1.1,
                "margin_floor": 45.00,
            },
            model="dynamic-pricing-v2",
            confidence=0.87,
        )
        .because(
            "Price increased due to high demand and low inventory",
            constraints=[
                "Price must not exceed competitor price",
                "Minimum margin of 40%",
                "Maximum 15% increase per adjustment",
            ],
            alternatives=[
                {"price": 52.99, "confidence": 0.82},
                {"price": 57.99, "confidence": 0.79},
            ],
            rejection_reasons={
                "52.99": "Lower confidence, leaves money on table",
                "57.99": "Too aggressive, may hurt conversion",
            },
        )
        .requires_approval(True)
        .record()
    )
    print(f"   Price adjusted: {pricing}")

    # Manager approves
    approval = (
        client.trace("price.approved", "Price change approved for WIDGET-001")
        .by_user("mgr-789", "Mike Manager", role="pricing_manager")
        .affecting_product("WIDGET-001")
        .because(
            "Approved price increase - aligns with Q4 strategy",
            context={"quarterly_target": "increase_margins"},
        )
        .child_of(pricing)
        .approved_by("mgr-789")
        .record()
    )
    print(f"   Manager approved: {approval}")

    # --- Query Examples ---
    print("\n=== Query Examples ===\n")

    # Get all events for the order
    print(f"Events for order {order_id}:")
    order_events = client.query(correlation_id=order_id, limit=10)
    for evt in order_events:
        print(f"  - {evt.event_type}: {evt.description}")

    # Get AI decisions
    print("\nAI-made decisions:")
    ai_events = client.query(actor_types=[ActorType.AI_AGENT], limit=10)
    for evt in ai_events:
        if evt.decision:
            print(f"  - {evt.event_type}: {evt.decision.reasoning[:50]}...")
            print(f"    Confidence: {evt.decision.confidence}")

    # Search decisions by reasoning
    print("\nSearch for 'fraud' in decision reasoning:")
    fraud_decisions = client.search("fraud")
    for evt in fraud_decisions:
        print(f"  - {evt.event_type}: {evt.decision.reasoning[:60]}...")

    # Get event chain
    print(f"\nEvent chain for shipment:")
    chain = client.get_chain(shipped)
    for evt in chain:
        print(f"  - {evt.event_type} ({evt.id[:8]}...)")

    # Stats
    print("\nDatabase statistics:")
    stats = client.stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")

    print("\n=== Demo Complete ===")


if __name__ == "__main__":
    main()
