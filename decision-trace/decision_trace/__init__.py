"""
Decision Trace - Task Tracking and Decision Tracing for Ecommerce

A framework built on ActivityWatch for tracking all events performed by users,
AI agents, or compute engines, along with the reasoning behind each decision.
"""

from .models import (
    Actor,
    ActorType,
    DecisionTrace,
    TrackedObject,
    ObjectType,
    TraceEvent,
    EventOutcome,
)
from .client import DecisionTraceClient
from .store import DecisionTraceStore

__version__ = "0.1.0"
__all__ = [
    "Actor",
    "ActorType",
    "DecisionTrace",
    "TrackedObject",
    "ObjectType",
    "TraceEvent",
    "EventOutcome",
    "DecisionTraceClient",
    "DecisionTraceStore",
]
