# Decision Trace

A task tracking and decision tracing framework for ecommerce operations. Built on [ActivityWatch](https://github.com/ActivityWatch/activitywatch) concepts, Decision Trace captures not just **what** happened, but **who** did it and **why**.

## Key Concepts

### Actors
Every action is performed by an **Actor** - a user, AI agent, or automated system:

```python
# Human users
Actor.user("user-123", "John Doe", email="john@example.com", role="support")

# AI agents
Actor.ai_agent("pricing-ai", "Dynamic Pricing", model="gpt-4", version="2.1")

# Automated systems
Actor.compute("cron-job", "Inventory Sync", service_name="warehouse-api")
```

### Decision Traces
Every action can include a **DecisionTrace** explaining the reasoning:

```python
.because(
    "Refund approved due to product defect",
    context={"defect_type": "manufacturing", "customer_tier": "gold"},
    alternatives=[
        {"action": "replace", "reason": "offer replacement instead"},
        {"action": "partial_refund", "reason": "50% refund option"}
    ],
    rejection_reasons={
        "replace": "Customer requested full refund",
        "partial_refund": "Clear manufacturer defect"
    }
)
```

### Tracked Objects
Link events to business objects like orders, products, and customers:

```python
.affecting_order("ord-123", {"status": "refunded", "refund_amount": 99.99})
.affecting_customer("cust-456")
.affecting_inventory("SKU-789", quantity_before=100, quantity_after=101)
```

## Quick Start

```python
from decision_trace import DecisionTraceClient
from decision_trace.ecommerce import EcommerceClient

# Initialize client
client = EcommerceClient()

# Record an order creation
client.order_created(
    order_id="ord-12345",
    customer_id="cust-67890",
    total=149.99,
    items=[{"sku": "WIDGET-001", "qty": 2, "price": 74.99}],
).by_user(
    "cust-67890", "Jane Customer", role="customer"
).because(
    "Customer completed checkout after 3 items in cart",
    context={"session_duration": "5m 32s", "coupon_applied": None}
).record()

# Record an AI decision
client.ai_recommendation(
    recommendation_type="inventory_restock",
    recommendation={"sku": "WIDGET-001", "quantity": 100},
    context={"current_stock": 15, "avg_daily_sales": 8},
    confidence=0.92,
    model="demand-forecast-v2",
).with_risk("medium").record()

# Query events
events = client.query(event_types=["order.created"], limit=10)
for event in events:
    print(f"{event.event_type}: {event.description}")
    if event.decision:
        print(f"  Reason: {event.decision.reasoning}")
```

## Core Features

### Fluent API for Recording Events

```python
client.trace("order.cancelled", "Order cancelled by customer") \
    .by_user("cust-123", "John Doe") \
    .affecting_order("ord-456", {"status": "cancelled"}) \
    .because(
        "Customer found better price elsewhere",
        context={"competitor": "competitor.com", "price_difference": 15.00}
    ) \
    .with_tags("cancellation", "price-sensitive") \
    .record()
```

### Duration Tracking with Spans

```python
with client.span("report.generation", "Generating monthly report") as trace:
    trace.by_compute("report-service", "Report Generator")
    # ... do work ...
# Duration automatically calculated when context exits
```

### Hierarchical Events

```python
# Parent event
workflow_id = client.trace("workflow.started", "Order fulfillment started") \
    .by_system("fulfillment-engine") \
    .record()

# Child events
client.trace("workflow.step", "Payment captured") \
    .child_of(workflow_id) \
    .record()
```

### Powerful Querying

```python
# Query by time range
events = client.query(
    start=datetime(2024, 1, 1),
    end=datetime(2024, 1, 31),
)

# Query by actor type
ai_decisions = client.query(actor_types=[ActorType.AI_AGENT])

# Query by affected objects
order_events = client.query(
    object_types=[ObjectType.ORDER],
    object_ids=["order-12345"]
)

# Full-text search on decision reasoning
results = client.search("price increase margin")

# Get event chain (parent/children)
chain = client.get_chain(event_id)

# Get object history
history = client.get_object_history(external_id="SKU-123", object_type=ObjectType.PRODUCT)
```

## Ecommerce Event Types

The `EcommerceClient` provides pre-built methods for common operations:

### Orders
- `order_created()`, `order_cancelled()`, `order_refunded()`

### Payments
- `payment_captured()`, `payment_failed()`

### Inventory
- `inventory_adjusted()`, `inventory_low_stock()`, `inventory_restock_ordered()`

### Shipping
- `shipment_created()`, `shipment_shipped()`, `shipment_delivered()`

### Returns
- `return_requested()`, `return_approved()`

### Customers
- `customer_created()`, `customer_tier_changed()`

### AI/Automation
- `ai_recommendation()`, `anomaly_detected()`, `automation_triggered()`

### Pricing
- `price_updated()`, `dynamic_price_adjusted()`

## Data Model

### TraceEvent
The core event model containing:
- **id**: Unique identifier
- **timestamp**: When the event occurred
- **duration**: How long it took
- **event_type**: Category of event (e.g., "order.created")
- **actor**: Who performed the action
- **decision**: Why it was done
- **objects**: What was affected
- **outcome**: Success/failure status
- **correlation_id**: For distributed tracing
- **parent_event_id**: For hierarchical events

### Actor Types
- `USER` - Human users
- `AI_AGENT` - AI/ML models
- `COMPUTE` - Automated scripts/jobs
- `SYSTEM` - System-level actions
- `EXTERNAL` - External services

### Object Types
Orders, Products, Customers, Inventory, Payments, Shipments, Returns, Campaigns, Promotions, and more.

## Storage

Data is stored in SQLite by default at:
```
~/.local/share/decision-trace/traces.db
```

Configure a custom path:
```python
client = DecisionTraceClient(db_path="/path/to/traces.db")
```

## Installation

```bash
pip install decision-trace
```

Or install from source:
```bash
cd decision-trace
pip install -e .
```

## Examples

See the `examples/` directory for complete demos:
- `basic_usage.py` - Core concepts
- `ecommerce_demo.py` - Full ecommerce scenario

## License

MIT License
