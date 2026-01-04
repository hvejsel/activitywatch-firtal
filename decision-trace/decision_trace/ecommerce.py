"""
Ecommerce-specific event types and helpers for decision tracing.

Provides standardized event types and convenience functions for common
ecommerce operations like order processing, inventory management,
customer interactions, and fulfillment.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Optional
from enum import Enum

from .client import DecisionTraceClient, TraceBuilder
from .models import ObjectType, TrackedObject, EventOutcome


class EcommerceEventType:
    """Standardized event types for ecommerce operations."""

    # Order Events
    ORDER_CREATED = "order.created"
    ORDER_UPDATED = "order.updated"
    ORDER_CANCELLED = "order.cancelled"
    ORDER_COMPLETED = "order.completed"
    ORDER_REFUNDED = "order.refunded"
    ORDER_PARTIALLY_REFUNDED = "order.partially_refunded"
    ORDER_ON_HOLD = "order.on_hold"
    ORDER_RELEASED = "order.released"
    ORDER_FRAUD_FLAGGED = "order.fraud_flagged"
    ORDER_FRAUD_CLEARED = "order.fraud_cleared"

    # Payment Events
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_AUTHORIZED = "payment.authorized"
    PAYMENT_CAPTURED = "payment.captured"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"
    PAYMENT_DISPUTED = "payment.disputed"
    PAYMENT_CHARGEBACK = "payment.chargeback"

    # Inventory Events
    INVENTORY_ADJUSTED = "inventory.adjusted"
    INVENTORY_RECEIVED = "inventory.received"
    INVENTORY_RESERVED = "inventory.reserved"
    INVENTORY_RELEASED = "inventory.released"
    INVENTORY_TRANSFERRED = "inventory.transferred"
    INVENTORY_COUNTED = "inventory.counted"
    INVENTORY_WRITTEN_OFF = "inventory.written_off"
    INVENTORY_LOW_STOCK_ALERT = "inventory.low_stock_alert"
    INVENTORY_RESTOCK_ORDERED = "inventory.restock_ordered"

    # Product Events
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    PRODUCT_PRICE_CHANGED = "product.price_changed"
    PRODUCT_DISCONTINUED = "product.discontinued"
    PRODUCT_RESTOCKED = "product.restocked"
    PRODUCT_OUT_OF_STOCK = "product.out_of_stock"

    # Customer Events
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_VERIFIED = "customer.verified"
    CUSTOMER_BLOCKED = "customer.blocked"
    CUSTOMER_UNBLOCKED = "customer.unblocked"
    CUSTOMER_MERGED = "customer.merged"
    CUSTOMER_TIER_CHANGED = "customer.tier_changed"

    # Shipping/Fulfillment Events
    SHIPMENT_CREATED = "shipment.created"
    SHIPMENT_PICKED = "shipment.picked"
    SHIPMENT_PACKED = "shipment.packed"
    SHIPMENT_SHIPPED = "shipment.shipped"
    SHIPMENT_IN_TRANSIT = "shipment.in_transit"
    SHIPMENT_OUT_FOR_DELIVERY = "shipment.out_for_delivery"
    SHIPMENT_DELIVERED = "shipment.delivered"
    SHIPMENT_FAILED = "shipment.failed"
    SHIPMENT_RETURNED = "shipment.returned"

    # Return Events
    RETURN_REQUESTED = "return.requested"
    RETURN_APPROVED = "return.approved"
    RETURN_REJECTED = "return.rejected"
    RETURN_RECEIVED = "return.received"
    RETURN_INSPECTED = "return.inspected"
    RETURN_PROCESSED = "return.processed"
    RETURN_REFUNDED = "return.refunded"

    # Marketing Events
    CAMPAIGN_LAUNCHED = "campaign.launched"
    CAMPAIGN_PAUSED = "campaign.paused"
    CAMPAIGN_ENDED = "campaign.ended"
    PROMOTION_APPLIED = "promotion.applied"
    COUPON_CREATED = "coupon.created"
    COUPON_USED = "coupon.used"
    COUPON_EXPIRED = "coupon.expired"
    EMAIL_SENT = "email.sent"
    EMAIL_OPENED = "email.opened"
    EMAIL_CLICKED = "email.clicked"

    # Cart Events
    CART_CREATED = "cart.created"
    CART_ITEM_ADDED = "cart.item_added"
    CART_ITEM_REMOVED = "cart.item_removed"
    CART_ABANDONED = "cart.abandoned"
    CART_RECOVERED = "cart.recovered"

    # Support Events
    SUPPORT_TICKET_CREATED = "support.ticket_created"
    SUPPORT_TICKET_UPDATED = "support.ticket_updated"
    SUPPORT_TICKET_RESOLVED = "support.ticket_resolved"
    SUPPORT_TICKET_ESCALATED = "support.ticket_escalated"

    # Pricing Events
    PRICE_UPDATED = "price.updated"
    PRICE_RULE_APPLIED = "price.rule_applied"
    DISCOUNT_APPLIED = "discount.applied"
    DYNAMIC_PRICING_ADJUSTED = "price.dynamic_adjusted"

    # Analytics/AI Events
    RECOMMENDATION_GENERATED = "ai.recommendation_generated"
    FORECAST_GENERATED = "ai.forecast_generated"
    ANOMALY_DETECTED = "ai.anomaly_detected"
    CLASSIFICATION_MADE = "ai.classification_made"
    AUTOMATION_TRIGGERED = "automation.triggered"


class EcommerceClient(DecisionTraceClient):
    """
    Extended client with ecommerce-specific convenience methods.

    Provides typed methods for common ecommerce operations with
    appropriate defaults and validation.
    """

    # === Order Operations ===

    def order_created(
        self,
        order_id: str,
        customer_id: str,
        total: float,
        items: List[Dict],
        **order_data
    ) -> TraceBuilder:
        """Record a new order creation."""
        return (
            self.trace(EcommerceEventType.ORDER_CREATED, f"Order {order_id} created")
            .affecting_order(order_id, {
                "total": total,
                "items": items,
                "status": "created",
                **order_data,
            })
            .affecting_customer(customer_id)
            .with_tags("order", "new")
        )

    def order_cancelled(
        self,
        order_id: str,
        reason: str,
        refund_amount: float = None,
    ) -> TraceBuilder:
        """Record an order cancellation."""
        builder = self.trace(
            EcommerceEventType.ORDER_CANCELLED,
            f"Order {order_id} cancelled: {reason}"
        ).affecting_order(order_id, {"status": "cancelled"})

        if refund_amount:
            builder.with_data(refund_amount=refund_amount)

        return builder.with_tags("order", "cancellation")

    def order_refunded(
        self,
        order_id: str,
        refund_amount: float,
        reason: str,
        payment_id: str = None,
    ) -> TraceBuilder:
        """Record an order refund."""
        builder = (
            self.trace(EcommerceEventType.ORDER_REFUNDED, f"Refund ${refund_amount} for order {order_id}")
            .affecting_order(order_id, {"refund_amount": refund_amount, "status": "refunded"})
            .because(reason)
            .with_tags("order", "refund")
        )

        if payment_id:
            builder.affecting_payment(payment_id, {"status": "refunded", "amount": refund_amount})

        return builder

    # === Inventory Operations ===

    def inventory_adjusted(
        self,
        sku: str,
        quantity_before: int,
        quantity_after: int,
        reason: str,
        location: str = None,
    ) -> TraceBuilder:
        """Record an inventory adjustment."""
        delta = quantity_after - quantity_before
        description = f"Inventory {sku}: {quantity_before} → {quantity_after} ({'+' if delta > 0 else ''}{delta})"

        builder = (
            self.trace(EcommerceEventType.INVENTORY_ADJUSTED, description)
            .affecting_inventory(sku, quantity_before, quantity_after)
            .because(reason)
            .with_data(delta=delta)
            .with_tags("inventory")
        )

        if location:
            builder.with_data(location=location)

        return builder

    def inventory_low_stock(
        self,
        sku: str,
        current_quantity: int,
        threshold: int,
        recommended_action: str = None,
    ) -> TraceBuilder:
        """Record a low stock alert."""
        return (
            self.trace(
                EcommerceEventType.INVENTORY_LOW_STOCK_ALERT,
                f"Low stock alert: {sku} at {current_quantity} (threshold: {threshold})"
            )
            .affecting_inventory(sku, quantity_after=current_quantity)
            .because(
                f"Stock level {current_quantity} is below threshold {threshold}",
                context={"threshold": threshold, "recommended_action": recommended_action}
            )
            .with_risk("medium" if current_quantity > 0 else "high")
            .with_tags("inventory", "alert", "low-stock")
        )

    def inventory_restock_ordered(
        self,
        sku: str,
        quantity_ordered: int,
        supplier: str,
        expected_arrival: datetime = None,
        cost: float = None,
    ) -> TraceBuilder:
        """Record a restock order."""
        builder = (
            self.trace(
                EcommerceEventType.INVENTORY_RESTOCK_ORDERED,
                f"Ordered {quantity_ordered} units of {sku} from {supplier}"
            )
            .affecting_inventory(sku)
            .affecting_object(
                ObjectType.SUPPLIER,
                f"supplier-{supplier}",
                external_id=supplier,
            )
            .with_data(quantity_ordered=quantity_ordered, supplier=supplier)
            .with_tags("inventory", "restock", "purchase-order")
        )

        if expected_arrival:
            builder.with_data(expected_arrival=expected_arrival.isoformat())
        if cost:
            builder.with_data(cost=cost)

        return builder

    # === Payment Operations ===

    def payment_captured(
        self,
        payment_id: str,
        order_id: str,
        amount: float,
        payment_method: str,
        processor: str = None,
    ) -> TraceBuilder:
        """Record a successful payment capture."""
        return (
            self.trace(EcommerceEventType.PAYMENT_CAPTURED, f"Payment ${amount} captured for order {order_id}")
            .affecting_payment(payment_id, {
                "amount": amount,
                "status": "captured",
                "method": payment_method,
            })
            .affecting_order(order_id)
            .with_source(processor or "payment-processor")
            .with_tags("payment", "capture")
        )

    def payment_failed(
        self,
        payment_id: str,
        order_id: str,
        amount: float,
        error_code: str,
        error_message: str,
    ) -> TraceBuilder:
        """Record a failed payment."""
        return (
            self.trace(EcommerceEventType.PAYMENT_FAILED, f"Payment failed for order {order_id}: {error_code}")
            .affecting_payment(payment_id, {"status": "failed", "amount": amount})
            .affecting_order(order_id)
            .failed(error_message, details=error_code)
            .with_tags("payment", "failure")
        )

    # === Shipping Operations ===

    def shipment_created(
        self,
        shipment_id: str,
        order_id: str,
        carrier: str,
        tracking_number: str = None,
        items: List[str] = None,
    ) -> TraceBuilder:
        """Record shipment creation."""
        builder = (
            self.trace(EcommerceEventType.SHIPMENT_CREATED, f"Shipment {shipment_id} created for order {order_id}")
            .affecting_shipment(shipment_id, {
                "status": "created",
                "carrier": carrier,
                "tracking_number": tracking_number,
            })
            .affecting_order(order_id)
            .with_tags("shipment", "fulfillment")
        )

        if items:
            builder.with_data(items=items)

        return builder

    def shipment_shipped(
        self,
        shipment_id: str,
        order_id: str,
        tracking_number: str,
        carrier: str,
        estimated_delivery: datetime = None,
    ) -> TraceBuilder:
        """Record shipment dispatch."""
        builder = (
            self.trace(EcommerceEventType.SHIPMENT_SHIPPED, f"Shipment {shipment_id} shipped via {carrier}")
            .affecting_shipment(shipment_id, {
                "status": "shipped",
                "tracking_number": tracking_number,
                "carrier": carrier,
            })
            .affecting_order(order_id)
            .with_tags("shipment", "shipped")
        )

        if estimated_delivery:
            builder.with_data(estimated_delivery=estimated_delivery.isoformat())

        return builder

    def shipment_delivered(
        self,
        shipment_id: str,
        order_id: str,
        delivery_time: datetime = None,
        signature: str = None,
    ) -> TraceBuilder:
        """Record successful delivery."""
        builder = (
            self.trace(EcommerceEventType.SHIPMENT_DELIVERED, f"Shipment {shipment_id} delivered")
            .affecting_shipment(shipment_id, {"status": "delivered"})
            .affecting_order(order_id)
            .with_tags("shipment", "delivered")
        )

        if delivery_time:
            builder.at(delivery_time)
        if signature:
            builder.with_data(signature=signature)

        return builder

    # === Customer Operations ===

    def customer_created(
        self,
        customer_id: str,
        email: str,
        source: str = None,
        **profile_data
    ) -> TraceBuilder:
        """Record new customer registration."""
        return (
            self.trace(EcommerceEventType.CUSTOMER_CREATED, f"New customer {customer_id} registered")
            .affecting_customer(customer_id, {
                "email": email,
                "status": "active",
                **profile_data,
            })
            .with_source(source or "website")
            .with_tags("customer", "registration")
        )

    def customer_tier_changed(
        self,
        customer_id: str,
        old_tier: str,
        new_tier: str,
        reason: str,
    ) -> TraceBuilder:
        """Record customer tier/loyalty level change."""
        return (
            self.trace(
                EcommerceEventType.CUSTOMER_TIER_CHANGED,
                f"Customer {customer_id} tier changed: {old_tier} → {new_tier}"
            )
            .affecting_customer(customer_id, state_before={"tier": old_tier}, state_after={"tier": new_tier})
            .because(reason)
            .with_tags("customer", "loyalty", "tier-change")
        )

    # === Return Operations ===

    def return_requested(
        self,
        return_id: str,
        order_id: str,
        customer_id: str,
        items: List[Dict],
        reason: str,
    ) -> TraceBuilder:
        """Record a return request."""
        return (
            self.trace(EcommerceEventType.RETURN_REQUESTED, f"Return {return_id} requested for order {order_id}")
            .affecting_object(ObjectType.RETURN, f"return-{return_id}", external_id=return_id, state_after={
                "status": "requested",
                "items": items,
            })
            .affecting_order(order_id)
            .affecting_customer(customer_id)
            .because(reason)
            .with_tags("return", "request")
        )

    def return_approved(
        self,
        return_id: str,
        order_id: str,
        refund_amount: float,
        approval_reason: str,
    ) -> TraceBuilder:
        """Record return approval."""
        return (
            self.trace(EcommerceEventType.RETURN_APPROVED, f"Return {return_id} approved, refund ${refund_amount}")
            .affecting_object(ObjectType.RETURN, f"return-{return_id}", state_after={
                "status": "approved",
                "refund_amount": refund_amount,
            })
            .affecting_order(order_id)
            .because(approval_reason)
            .with_tags("return", "approved")
        )

    # === AI/Automation Operations ===

    def ai_recommendation(
        self,
        recommendation_type: str,
        recommendation: Dict[str, Any],
        context: Dict[str, Any],
        confidence: float,
        model: str,
        affected_objects: List[TrackedObject] = None,
    ) -> TraceBuilder:
        """Record an AI-generated recommendation."""
        builder = (
            self.trace(
                EcommerceEventType.RECOMMENDATION_GENERATED,
                f"AI recommendation: {recommendation_type}"
            )
            .by_ai(f"ai-{model}", f"AI Recommender ({recommendation_type})", model=model)
            .with_confidence(confidence)
            .because(
                f"Generated {recommendation_type} recommendation",
                context=context,
            )
            .with_data(recommendation=recommendation)
            .with_tags("ai", "recommendation", recommendation_type)
        )

        if affected_objects:
            for obj in affected_objects:
                builder.affecting(obj)

        return builder

    def anomaly_detected(
        self,
        anomaly_type: str,
        description: str,
        severity: str,
        context: Dict[str, Any],
        model: str = "anomaly-detector",
        affected_objects: List[TrackedObject] = None,
    ) -> TraceBuilder:
        """Record an anomaly detection."""
        builder = (
            self.trace(EcommerceEventType.ANOMALY_DETECTED, f"Anomaly detected: {anomaly_type}")
            .by_ai(f"ai-{model}", "Anomaly Detector", model=model)
            .because(description, context=context)
            .with_risk(severity)
            .with_tags("ai", "anomaly", anomaly_type, severity)
        )

        if affected_objects:
            for obj in affected_objects:
                builder.affecting(obj)

        return builder

    def automation_triggered(
        self,
        automation_name: str,
        trigger: str,
        actions_taken: List[str],
        context: Dict[str, Any] = None,
    ) -> TraceBuilder:
        """Record an automation trigger."""
        return (
            self.trace(
                EcommerceEventType.AUTOMATION_TRIGGERED,
                f"Automation '{automation_name}' triggered by {trigger}"
            )
            .by_compute(f"automation-{automation_name}", automation_name, service_name="automation-engine")
            .triggered_by(trigger)
            .because(
                f"Automation triggered: {trigger}",
                context=context or {},
            )
            .with_data(actions=actions_taken)
            .with_tags("automation", automation_name)
        )

    # === Pricing Operations ===

    def price_updated(
        self,
        product_id: str,
        old_price: float,
        new_price: float,
        reason: str,
        effective_date: datetime = None,
    ) -> TraceBuilder:
        """Record a price change."""
        return (
            self.trace(
                EcommerceEventType.PRICE_UPDATED,
                f"Price updated for {product_id}: ${old_price} → ${new_price}"
            )
            .affecting_product(product_id)
            .affecting_object(
                ObjectType.PRICE,
                f"price-{product_id}",
                state_before={"price": old_price},
                state_after={"price": new_price},
            )
            .because(reason)
            .with_data(
                price_change=new_price - old_price,
                price_change_pct=((new_price - old_price) / old_price) * 100 if old_price > 0 else 0,
            )
            .with_tags("pricing", "price-change")
        )

    def dynamic_price_adjusted(
        self,
        product_id: str,
        old_price: float,
        new_price: float,
        factors: Dict[str, Any],
        model: str,
        confidence: float,
    ) -> TraceBuilder:
        """Record a dynamic pricing adjustment by AI."""
        return (
            self.trace(
                EcommerceEventType.DYNAMIC_PRICING_ADJUSTED,
                f"Dynamic price adjustment for {product_id}: ${old_price} → ${new_price}"
            )
            .by_ai(f"ai-{model}", "Dynamic Pricing Engine", model=model)
            .with_confidence(confidence)
            .affecting_product(product_id)
            .affecting_object(
                ObjectType.PRICE,
                f"price-{product_id}",
                state_before={"price": old_price},
                state_after={"price": new_price},
            )
            .because(
                "Dynamic pricing adjustment based on market factors",
                context=factors,
            )
            .with_tags("pricing", "dynamic", "ai")
        )
