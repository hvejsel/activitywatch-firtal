"""
Decision Trace Store - Persistence layer for decision traces.

Uses SQLite for local storage, compatible with ActivityWatch's approach.
"""

import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from contextlib import contextmanager

from .models import TraceEvent, Actor, DecisionTrace, TrackedObject, ActorType, ObjectType, EventOutcome


class DecisionTraceStore:
    """
    SQLite-based storage for decision traces.

    Provides efficient storage and querying of trace events with full-text search
    on decision reasoning and event descriptions.
    """

    def __init__(self, db_path: str = None):
        """
        Initialize the decision trace store.

        Args:
            db_path: Path to SQLite database file. Defaults to ~/.local/share/decision-trace/traces.db
        """
        if db_path is None:
            data_dir = Path.home() / ".local" / "share" / "decision-trace"
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / "traces.db")

        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        """Initialize database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Main events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trace_events (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    duration REAL DEFAULT 0,
                    event_type TEXT NOT NULL,
                    description TEXT,
                    outcome TEXT DEFAULT 'success',
                    outcome_details TEXT,
                    error TEXT,
                    parent_event_id TEXT,
                    correlation_id TEXT,
                    source_system TEXT,
                    source_ip TEXT,
                    data_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_event_id) REFERENCES trace_events(id)
                )
            """)

            # Actors table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS actors (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    metadata_json TEXT,
                    model TEXT,
                    version TEXT,
                    email TEXT,
                    role TEXT,
                    service_name TEXT,
                    job_id TEXT
                )
            """)

            # Event-Actor relationship (who performed the event)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_actors (
                    event_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    PRIMARY KEY (event_id, actor_id),
                    FOREIGN KEY (event_id) REFERENCES trace_events(id),
                    FOREIGN KEY (actor_id) REFERENCES actors(id)
                )
            """)

            # Decisions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS decisions (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    reasoning TEXT,
                    context_json TEXT,
                    constraints_json TEXT,
                    alternatives_json TEXT,
                    rejection_reasons_json TEXT,
                    confidence REAL,
                    risk_level TEXT,
                    requires_approval INTEGER DEFAULT 0,
                    approved_by TEXT,
                    trigger TEXT,
                    trigger_event_id TEXT,
                    depends_on_json TEXT,
                    FOREIGN KEY (event_id) REFERENCES trace_events(id),
                    FOREIGN KEY (approved_by) REFERENCES actors(id)
                )
            """)

            # Tracked objects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tracked_objects (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    external_id TEXT,
                    name TEXT,
                    metadata_json TEXT,
                    state_before_json TEXT,
                    state_after_json TEXT
                )
            """)

            # Event-Object relationship (what objects were affected)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_objects (
                    event_id TEXT NOT NULL,
                    object_id TEXT NOT NULL,
                    PRIMARY KEY (event_id, object_id),
                    FOREIGN KEY (event_id) REFERENCES trace_events(id),
                    FOREIGN KEY (object_id) REFERENCES tracked_objects(id)
                )
            """)

            # Tags table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_tags (
                    event_id TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    PRIMARY KEY (event_id, tag),
                    FOREIGN KEY (event_id) REFERENCES trace_events(id)
                )
            """)

            # Indexes for common queries
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON trace_events(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON trace_events(event_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_correlation ON trace_events(correlation_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_source ON trace_events(source_system)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_actors_type ON actors(type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_objects_type ON tracked_objects(type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_objects_external ON tracked_objects(external_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action)")

            # Full-text search for reasoning
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
                    decision_id,
                    action,
                    reasoning,
                    content='decisions',
                    content_rowid='rowid'
                )
            """)

    def save_event(self, event: TraceEvent) -> str:
        """
        Save a trace event to the database.

        Args:
            event: The TraceEvent to save

        Returns:
            The event ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Save the main event
            cursor.execute("""
                INSERT OR REPLACE INTO trace_events
                (id, timestamp, duration, event_type, description, outcome,
                 outcome_details, error, parent_event_id, correlation_id,
                 source_system, source_ip, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event.id,
                event.timestamp.isoformat(),
                event.duration.total_seconds(),
                event.event_type,
                event.description,
                event.outcome.value,
                event.outcome_details,
                event.error,
                event.parent_event_id,
                event.correlation_id,
                event.source_system,
                event.source_ip,
                json.dumps(event.data),
            ))

            # Save actor if present
            if event.actor:
                self._save_actor(cursor, event.actor)
                cursor.execute("""
                    INSERT OR REPLACE INTO event_actors (event_id, actor_id)
                    VALUES (?, ?)
                """, (event.id, event.actor.id))

            # Save decision if present
            if event.decision:
                self._save_decision(cursor, event.id, event.decision)

            # Save objects
            for obj in event.objects:
                self._save_object(cursor, obj)
                cursor.execute("""
                    INSERT OR REPLACE INTO event_objects (event_id, object_id)
                    VALUES (?, ?)
                """, (event.id, obj.id))

            # Save tags
            for tag in event.tags:
                cursor.execute("""
                    INSERT OR REPLACE INTO event_tags (event_id, tag)
                    VALUES (?, ?)
                """, (event.id, tag))

        return event.id

    def _save_actor(self, cursor: sqlite3.Cursor, actor: Actor):
        """Save an actor to the database."""
        cursor.execute("""
            INSERT OR REPLACE INTO actors
            (id, type, name, metadata_json, model, version, email, role, service_name, job_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            actor.id,
            actor.type.value,
            actor.name,
            json.dumps(actor.metadata),
            actor.model,
            actor.version,
            actor.email,
            actor.role,
            actor.service_name,
            actor.job_id,
        ))

    def _save_decision(self, cursor: sqlite3.Cursor, event_id: str, decision: DecisionTrace):
        """Save a decision to the database."""
        cursor.execute("""
            INSERT OR REPLACE INTO decisions
            (id, event_id, action, reasoning, context_json, constraints_json,
             alternatives_json, rejection_reasons_json, confidence, risk_level,
             requires_approval, approved_by, trigger, trigger_event_id, depends_on_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            decision.id,
            event_id,
            decision.action,
            decision.reasoning,
            json.dumps(decision.context),
            json.dumps(decision.constraints),
            json.dumps(decision.alternatives),
            json.dumps(decision.rejection_reasons),
            decision.confidence,
            decision.risk_level,
            1 if decision.requires_approval else 0,
            decision.approved_by,
            decision.trigger,
            decision.trigger_event_id,
            json.dumps(decision.depends_on),
        ))

        # Update FTS index
        cursor.execute("""
            INSERT OR REPLACE INTO decisions_fts (decision_id, action, reasoning)
            VALUES (?, ?, ?)
        """, (decision.id, decision.action, decision.reasoning))

    def _save_object(self, cursor: sqlite3.Cursor, obj: TrackedObject):
        """Save a tracked object to the database."""
        cursor.execute("""
            INSERT OR REPLACE INTO tracked_objects
            (id, type, external_id, name, metadata_json, state_before_json, state_after_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            obj.id,
            obj.type.value,
            obj.external_id,
            obj.name,
            json.dumps(obj.metadata),
            json.dumps(obj.state_before) if obj.state_before else None,
            json.dumps(obj.state_after) if obj.state_after else None,
        ))

    def get_event(self, event_id: str) -> Optional[TraceEvent]:
        """
        Retrieve a single event by ID.

        Args:
            event_id: The event ID to retrieve

        Returns:
            The TraceEvent or None if not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM trace_events WHERE id = ?", (event_id,))
            row = cursor.fetchone()

            if not row:
                return None

            return self._row_to_event(cursor, row)

    def _row_to_event(self, cursor: sqlite3.Cursor, row: sqlite3.Row) -> TraceEvent:
        """Convert a database row to a TraceEvent."""
        event_id = row["id"]

        # Get actor
        cursor.execute("""
            SELECT a.* FROM actors a
            JOIN event_actors ea ON a.id = ea.actor_id
            WHERE ea.event_id = ?
        """, (event_id,))
        actor_row = cursor.fetchone()
        actor = self._row_to_actor(actor_row) if actor_row else None

        # Get decision
        cursor.execute("SELECT * FROM decisions WHERE event_id = ?", (event_id,))
        decision_row = cursor.fetchone()
        decision = self._row_to_decision(decision_row) if decision_row else None

        # Get objects
        cursor.execute("""
            SELECT o.* FROM tracked_objects o
            JOIN event_objects eo ON o.id = eo.object_id
            WHERE eo.event_id = ?
        """, (event_id,))
        objects = [self._row_to_object(obj_row) for obj_row in cursor.fetchall()]

        # Get tags
        cursor.execute("SELECT tag FROM event_tags WHERE event_id = ?", (event_id,))
        tags = [tag_row["tag"] for tag_row in cursor.fetchall()]

        return TraceEvent(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            duration=timedelta(seconds=row["duration"]),
            event_type=row["event_type"],
            description=row["description"] or "",
            actor=actor,
            decision=decision,
            objects=objects,
            outcome=EventOutcome(row["outcome"]),
            outcome_details=row["outcome_details"],
            error=row["error"],
            tags=tags,
            parent_event_id=row["parent_event_id"],
            correlation_id=row["correlation_id"],
            source_system=row["source_system"],
            source_ip=row["source_ip"],
            data=json.loads(row["data_json"]) if row["data_json"] else {},
        )

    def _row_to_actor(self, row: sqlite3.Row) -> Actor:
        """Convert a database row to an Actor."""
        return Actor(
            id=row["id"],
            type=ActorType(row["type"]),
            name=row["name"],
            metadata=json.loads(row["metadata_json"]) if row["metadata_json"] else {},
            model=row["model"],
            version=row["version"],
            email=row["email"],
            role=row["role"],
            service_name=row["service_name"],
            job_id=row["job_id"],
        )

    def _row_to_decision(self, row: sqlite3.Row) -> DecisionTrace:
        """Convert a database row to a DecisionTrace."""
        return DecisionTrace(
            id=row["id"],
            action=row["action"],
            reasoning=row["reasoning"] or "",
            context=json.loads(row["context_json"]) if row["context_json"] else {},
            constraints=json.loads(row["constraints_json"]) if row["constraints_json"] else [],
            alternatives=json.loads(row["alternatives_json"]) if row["alternatives_json"] else [],
            rejection_reasons=json.loads(row["rejection_reasons_json"]) if row["rejection_reasons_json"] else {},
            confidence=row["confidence"],
            risk_level=row["risk_level"],
            requires_approval=bool(row["requires_approval"]),
            approved_by=row["approved_by"],
            trigger=row["trigger"],
            trigger_event_id=row["trigger_event_id"],
            depends_on=json.loads(row["depends_on_json"]) if row["depends_on_json"] else [],
        )

    def _row_to_object(self, row: sqlite3.Row) -> TrackedObject:
        """Convert a database row to a TrackedObject."""
        return TrackedObject(
            id=row["id"],
            type=ObjectType(row["type"]),
            external_id=row["external_id"],
            name=row["name"],
            metadata=json.loads(row["metadata_json"]) if row["metadata_json"] else {},
            state_before=json.loads(row["state_before_json"]) if row["state_before_json"] else None,
            state_after=json.loads(row["state_after_json"]) if row["state_after_json"] else None,
        )

    def query_events(
        self,
        start: datetime = None,
        end: datetime = None,
        event_types: List[str] = None,
        actor_ids: List[str] = None,
        actor_types: List[ActorType] = None,
        object_ids: List[str] = None,
        object_types: List[ObjectType] = None,
        correlation_id: str = None,
        tags: List[str] = None,
        source_system: str = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TraceEvent]:
        """
        Query events with flexible filtering.

        Args:
            start: Filter events after this timestamp
            end: Filter events before this timestamp
            event_types: Filter by event types
            actor_ids: Filter by actor IDs
            actor_types: Filter by actor types
            object_ids: Filter by object IDs
            object_types: Filter by object types
            correlation_id: Filter by correlation ID
            tags: Filter by tags (events must have ALL specified tags)
            source_system: Filter by source system
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of matching TraceEvents
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT DISTINCT e.* FROM trace_events e"
            joins = []
            conditions = []
            params = []

            # Build joins based on filters
            if actor_ids or actor_types:
                joins.append("JOIN event_actors ea ON e.id = ea.event_id")
                joins.append("JOIN actors a ON ea.actor_id = a.id")

            if object_ids or object_types:
                joins.append("JOIN event_objects eo ON e.id = eo.event_id")
                joins.append("JOIN tracked_objects o ON eo.object_id = o.id")

            if tags:
                joins.append("JOIN event_tags et ON e.id = et.event_id")

            # Build conditions
            if start:
                conditions.append("e.timestamp >= ?")
                params.append(start.isoformat())

            if end:
                conditions.append("e.timestamp <= ?")
                params.append(end.isoformat())

            if event_types:
                placeholders = ",".join("?" * len(event_types))
                conditions.append(f"e.event_type IN ({placeholders})")
                params.extend(event_types)

            if actor_ids:
                placeholders = ",".join("?" * len(actor_ids))
                conditions.append(f"a.id IN ({placeholders})")
                params.extend(actor_ids)

            if actor_types:
                placeholders = ",".join("?" * len(actor_types))
                conditions.append(f"a.type IN ({placeholders})")
                params.extend([t.value for t in actor_types])

            if object_ids:
                placeholders = ",".join("?" * len(object_ids))
                conditions.append(f"o.id IN ({placeholders})")
                params.extend(object_ids)

            if object_types:
                placeholders = ",".join("?" * len(object_types))
                conditions.append(f"o.type IN ({placeholders})")
                params.extend([t.value for t in object_types])

            if correlation_id:
                conditions.append("e.correlation_id = ?")
                params.append(correlation_id)

            if tags:
                placeholders = ",".join("?" * len(tags))
                conditions.append(f"et.tag IN ({placeholders})")
                params.extend(tags)
                # Ensure event has ALL specified tags
                conditions.append(f"""
                    (SELECT COUNT(DISTINCT tag) FROM event_tags
                     WHERE event_id = e.id AND tag IN ({placeholders})) = ?
                """)
                params.extend(tags)
                params.append(len(tags))

            if source_system:
                conditions.append("e.source_system = ?")
                params.append(source_system)

            # Build final query
            query += " " + " ".join(joins)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY e.timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            rows = cursor.fetchall()

            return [self._row_to_event(cursor, row) for row in rows]

    def search_decisions(self, query: str, limit: int = 50) -> List[TraceEvent]:
        """
        Full-text search on decision reasoning and actions.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of TraceEvents with matching decisions
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT e.* FROM trace_events e
                JOIN decisions d ON e.id = d.event_id
                JOIN decisions_fts fts ON d.id = fts.decision_id
                WHERE decisions_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (query, limit))

            rows = cursor.fetchall()
            return [self._row_to_event(cursor, row) for row in rows]

    def get_event_chain(self, event_id: str) -> List[TraceEvent]:
        """
        Get the full chain of related events (parent/child hierarchy).

        Args:
            event_id: Starting event ID

        Returns:
            List of related events in chronological order
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Find root event
            root_id = event_id
            while True:
                cursor.execute(
                    "SELECT parent_event_id FROM trace_events WHERE id = ?",
                    (root_id,)
                )
                row = cursor.fetchone()
                if not row or not row["parent_event_id"]:
                    break
                root_id = row["parent_event_id"]

            # Get all descendants recursively
            cursor.execute("""
                WITH RECURSIVE event_tree AS (
                    SELECT id, timestamp FROM trace_events WHERE id = ?
                    UNION ALL
                    SELECT e.id, e.timestamp FROM trace_events e
                    JOIN event_tree et ON e.parent_event_id = et.id
                )
                SELECT e.* FROM trace_events e
                JOIN event_tree et ON e.id = et.id
                ORDER BY e.timestamp
            """, (root_id,))

            rows = cursor.fetchall()
            return [self._row_to_event(cursor, row) for row in rows]

    def get_object_history(
        self,
        object_id: str = None,
        external_id: str = None,
        object_type: ObjectType = None,
        limit: int = 100,
    ) -> List[TraceEvent]:
        """
        Get the history of events for a specific object.

        Args:
            object_id: Internal object ID
            external_id: External system ID
            object_type: Type of object (required with external_id)
            limit: Maximum results

        Returns:
            List of events affecting this object
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            if object_id:
                cursor.execute("""
                    SELECT e.* FROM trace_events e
                    JOIN event_objects eo ON e.id = eo.event_id
                    WHERE eo.object_id = ?
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                """, (object_id, limit))
            elif external_id and object_type:
                cursor.execute("""
                    SELECT e.* FROM trace_events e
                    JOIN event_objects eo ON e.id = eo.event_id
                    JOIN tracked_objects o ON eo.object_id = o.id
                    WHERE o.external_id = ? AND o.type = ?
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                """, (external_id, object_type.value, limit))
            else:
                raise ValueError("Must provide object_id or (external_id and object_type)")

            rows = cursor.fetchall()
            return [self._row_to_event(cursor, row) for row in rows]

    def get_actor_activity(
        self,
        actor_id: str,
        start: datetime = None,
        end: datetime = None,
        limit: int = 100,
    ) -> List[TraceEvent]:
        """
        Get all events performed by a specific actor.

        Args:
            actor_id: The actor ID
            start: Start of time range
            end: End of time range
            limit: Maximum results

        Returns:
            List of events by this actor
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT e.* FROM trace_events e
                JOIN event_actors ea ON e.id = ea.event_id
                WHERE ea.actor_id = ?
            """
            params = [actor_id]

            if start:
                query += " AND e.timestamp >= ?"
                params.append(start.isoformat())

            if end:
                query += " AND e.timestamp <= ?"
                params.append(end.isoformat())

            query += " ORDER BY e.timestamp DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_event(cursor, row) for row in rows]

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the stored traces."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) as count FROM trace_events")
            total_events = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM actors")
            total_actors = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM tracked_objects")
            total_objects = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM decisions")
            total_decisions = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT event_type, COUNT(*) as count
                FROM trace_events
                GROUP BY event_type
                ORDER BY count DESC
                LIMIT 10
            """)
            top_event_types = {row["event_type"]: row["count"] for row in cursor.fetchall()}

            cursor.execute("""
                SELECT type, COUNT(*) as count
                FROM actors
                GROUP BY type
            """)
            actors_by_type = {row["type"]: row["count"] for row in cursor.fetchall()}

            return {
                "total_events": total_events,
                "total_actors": total_actors,
                "total_objects": total_objects,
                "total_decisions": total_decisions,
                "top_event_types": top_event_types,
                "actors_by_type": actors_by_type,
            }
