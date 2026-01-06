# Process Mining Refactor Plan

## Overview

This plan outlines a comprehensive refactor to add process/task mining capabilities to ActivityWatch, enabling:
- Sequential pattern detection and event grouping
- Object attachment at all levels (events, steps, workflows)
- Hierarchical drill-down from processes → steps → events
- Pattern saving and measurement

---

## New Data Model Architecture

### Hierarchy

```
Workflow/Process
├── Step (1..n)
│   ├── Event (1..n)
│   │   └── Object attachments (0..n)
│   └── Object attachments (0..n)
└── Object attachments (0..n)
```

### New Entities

#### 1. Object
An entity that can be attached to events, steps, or workflows. Objects are **global** (not bucket-specific).

```python
# aw-core/aw_core/models.py
class Object(dict):
    id: str                    # Unique identifier (UUID)
    name: str                  # Display name (e.g., "PO-2024-001234")
    type: str                  # Object type (see E-commerce Object Types below)
    data: Dict[str, Any]       # Custom metadata (e.g., supplier_id, total_amount)
    created: datetime
    updated: datetime
```

**E-commerce Object Types:**
| Type | Description | Example Name |
|------|-------------|--------------|
| `purchase_order` | Purchase order | PO-2024-001234 |
| `order` | Sales/customer order | ORD-2024-005678 |
| `purchase_order_item` | Line item on PO | PO-2024-001234-LINE-01 |
| `purchase_order_invoice` | Invoice for PO | INV-2024-009876 |
| `purchase_order_invoice_item` | Line item on invoice | INV-2024-009876-LINE-01 |
| `shipment` | Shipment/delivery | SHIP-2024-003456 |
| `stock_movement` | Inventory movement | STK-2024-007890 |
| `ledger_entry` | Accounting entry | LED-2024-002345 |
| `task` | Work task | TASK-2024-004567 |
| `supplier` | Supplier/vendor | SUP-ACME-CORP |
| `product` | Product/SKU | PRD-SKU-12345 |

#### 2. ObjectExtractionRule
Rules for automatically identifying objects from event data.

```python
class ObjectExtractionRule(dict):
    id: str                    # Rule identifier
    name: str                  # Rule name (e.g., "Extract PO from window title")
    object_type: str           # Target object type (e.g., "purchase_order")
    source_fields: List[str]   # Event fields to search (e.g., ["title", "url"])
    pattern: str               # Regex pattern with named groups
    name_template: str         # Template for object name (e.g., "PO-{po_number}")
    data_mapping: Dict[str, str]  # Map regex groups to object.data fields
    enabled: bool
    priority: int              # Higher priority rules match first
```

**Example Extraction Rules:**
```python
# Extract Purchase Order from window title like "Purchase Order PO-2024-001234 - ERP System"
ObjectExtractionRule(
    name="PO from window title",
    object_type="purchase_order",
    source_fields=["title"],
    pattern=r"(?:Purchase Order|PO)\s*(?P<po_number>PO-\d{4}-\d{6})",
    name_template="{po_number}",
    data_mapping={"po_number": "po_number"}
)

# Extract Order from URL like "https://erp.example.com/orders/ORD-2024-005678"
ObjectExtractionRule(
    name="Order from URL",
    object_type="order",
    source_fields=["url"],
    pattern=r"/orders/(?P<order_id>ORD-\d{4}-\d{6})",
    name_template="{order_id}",
    data_mapping={"order_id": "order_id"}
)

# Extract Supplier from any field
ObjectExtractionRule(
    name="Supplier from title",
    object_type="supplier",
    source_fields=["title", "url"],
    pattern=r"(?:Supplier|Vendor):\s*(?P<supplier_name>[A-Za-z0-9\s\-]+)",
    name_template="SUP-{supplier_name}",
    data_mapping={"supplier_name": "name"}
)
```

#### 3. Step
A grouping of related events representing a discrete action/activity.

```python
class Step(dict):
    id: str                    # Unique identifier
    name: str                  # Step name/label
    event_ids: List[str]       # References to events in this step
    object_ids: List[str]      # Attached objects
    start_time: datetime
    end_time: datetime
    duration: float            # Computed from events
    data: Dict[str, Any]       # Step metadata (e.g., app pattern, category)
```

#### 4. Workflow (Process)
A collection of steps representing a complete process pattern.

```python
class Workflow(dict):
    id: str                    # Unique identifier
    name: str                  # Workflow name
    description: str           # Description
    step_ids: List[str]        # Ordered list of step IDs
    object_ids: List[str]      # Attached objects
    pattern: Dict[str, Any]    # The pattern definition used for mining
    occurrences: List[WorkflowOccurrence]  # Each time this workflow was detected
    created: datetime
    updated: datetime

class WorkflowOccurrence(dict):
    id: str
    workflow_id: str
    step_instances: List[StepInstance]  # Actual step instances for this occurrence
    start_time: datetime
    end_time: datetime
    duration: float
```

#### 5. Event Extension
Extend existing Event model to support object attachments.

```python
# Add to existing Event model
class Event(dict):
    # ... existing fields ...
    object_ids: List[str]      # Attached objects (optional, defaults to [])
```

---

## Database Schema Changes

### New Tables (SQLite / PostgreSQL)

```sql
-- Objects table (global, not bucket-specific)
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSON,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL
);

-- Object extraction rules (for automatic object identification)
CREATE TABLE object_extraction_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    object_type TEXT NOT NULL,
    source_fields JSON NOT NULL,       -- ["title", "url"]
    pattern TEXT NOT NULL,             -- Regex with named groups
    name_template TEXT NOT NULL,       -- "{po_number}"
    data_mapping JSON,                 -- {"po_number": "po_number"}
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL
);

-- Object types (user-definable)
CREATE TABLE object_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                -- "purchase_order"
    display_name TEXT NOT NULL,        -- "Purchase Order"
    description TEXT,
    icon TEXT,                         -- Icon identifier
    color TEXT,                        -- Hex color for UI
    data_schema JSON,                  -- JSON schema for type-specific data fields
    created TIMESTAMP NOT NULL
);

-- Steps table
CREATE TABLE steps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration REAL NOT NULL,
    data JSON
);

-- Workflows table
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    pattern JSON NOT NULL,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL
);

-- Workflow occurrences table
CREATE TABLE workflow_occurrences (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration REAL NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Junction tables for many-to-many relationships
CREATE TABLE event_objects (
    event_id INTEGER NOT NULL,
    bucket_id TEXT NOT NULL,
    object_id TEXT NOT NULL REFERENCES objects(id),
    PRIMARY KEY (event_id, bucket_id, object_id)
);

CREATE TABLE step_events (
    step_id TEXT NOT NULL REFERENCES steps(id),
    event_id INTEGER NOT NULL,
    bucket_id TEXT NOT NULL,
    PRIMARY KEY (step_id, event_id, bucket_id)
);

CREATE TABLE step_objects (
    step_id TEXT NOT NULL REFERENCES steps(id),
    object_id TEXT NOT NULL REFERENCES objects(id),
    PRIMARY KEY (step_id, object_id)
);

CREATE TABLE workflow_steps (
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    step_id TEXT NOT NULL REFERENCES steps(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (workflow_id, step_id)
);

CREATE TABLE workflow_objects (
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    object_id TEXT NOT NULL REFERENCES objects(id),
    PRIMARY KEY (workflow_id, object_id)
);

CREATE TABLE occurrence_step_instances (
    occurrence_id TEXT NOT NULL REFERENCES workflow_occurrences(id),
    step_id TEXT NOT NULL REFERENCES steps(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (occurrence_id, step_id, position)
);
```

---

## New API Endpoints

### Object Types API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/object-types` | List all object types |
| POST | `/api/0/object-types` | Create new object type |
| GET | `/api/0/object-types/<id>` | Get object type by ID |
| PUT | `/api/0/object-types/<id>` | Update object type |
| DELETE | `/api/0/object-types/<id>` | Delete object type |

### Object Extraction Rules API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/extraction-rules` | List all extraction rules |
| POST | `/api/0/extraction-rules` | Create new extraction rule |
| GET | `/api/0/extraction-rules/<id>` | Get rule by ID |
| PUT | `/api/0/extraction-rules/<id>` | Update rule |
| DELETE | `/api/0/extraction-rules/<id>` | Delete rule |
| POST | `/api/0/extraction-rules/<id>/test` | Test rule against sample events |
| POST | `/api/0/extraction-rules/run` | Run all enabled rules on events (extract objects) |

### Objects API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/objects` | List all objects (filter by type, name, date range) |
| POST | `/api/0/objects` | Create new object (manual) |
| GET | `/api/0/objects/<id>` | Get object by ID |
| PUT | `/api/0/objects/<id>` | Update object |
| DELETE | `/api/0/objects/<id>` | Delete object |
| GET | `/api/0/objects/<id>/events` | Get all events linked to this object |
| GET | `/api/0/objects/<id>/timeline` | Get object activity timeline |

### Object Attachments API (Manual + Automatic)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/0/buckets/<bucket_id>/events/<event_id>/objects` | Attach object to event |
| DELETE | `/api/0/buckets/<bucket_id>/events/<event_id>/objects/<object_id>` | Detach object from event |
| GET | `/api/0/buckets/<bucket_id>/events/<event_id>/objects` | List objects on event |

### Steps API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/steps` | List all steps (with time range filtering) |
| POST | `/api/0/steps` | Create step from events |
| GET | `/api/0/steps/<id>` | Get step with events |
| PUT | `/api/0/steps/<id>` | Update step |
| DELETE | `/api/0/steps/<id>` | Delete step |
| POST | `/api/0/steps/<id>/objects` | Attach object to step |
| DELETE | `/api/0/steps/<id>/objects/<object_id>` | Detach object from step |
| GET | `/api/0/steps/<id>/events` | Get all events in step |

### Workflows API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/workflows` | List all workflows |
| POST | `/api/0/workflows` | Create/save workflow pattern |
| GET | `/api/0/workflows/<id>` | Get workflow with steps |
| PUT | `/api/0/workflows/<id>` | Update workflow |
| DELETE | `/api/0/workflows/<id>` | Delete workflow |
| POST | `/api/0/workflows/<id>/objects` | Attach object to workflow |
| DELETE | `/api/0/workflows/<id>/objects/<object_id>` | Detach object |
| GET | `/api/0/workflows/<id>/occurrences` | Get all occurrences of workflow |
| GET | `/api/0/workflows/<id>/occurrences/<occ_id>` | Get specific occurrence with full event details |

### Pattern Mining API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/0/mining/patterns` | Detect sequential patterns in events |
| POST | `/api/0/mining/group-events` | Group events into steps |
| POST | `/api/0/mining/discover-workflows` | Discover workflow patterns |
| POST | `/api/0/mining/match-workflow` | Find occurrences matching a workflow pattern |

---

## Object Extraction Implementation

### Location: `aw-core/aw_mining/objects.py`

Object identification supports **both automatic extraction AND manual tagging**.

#### Automatic Object Extraction

```python
# aw-core/aw_mining/objects.py

def extract_objects_from_events(
    events: List[Event],
    rules: List[ObjectExtractionRule],
    create_if_missing: bool = True
) -> List[Tuple[Event, List[Object]]]:
    """
    Run extraction rules against events to identify and link objects.

    For each event:
    1. Apply all enabled rules in priority order
    2. For each match, either find existing object or create new one
    3. Link object to event via event_objects table

    Returns list of (event, extracted_objects) tuples.
    """
    pass

def apply_extraction_rule(
    event: Event,
    rule: ObjectExtractionRule
) -> Optional[Object]:
    """
    Apply a single extraction rule to an event.

    1. Concatenate values from source_fields
    2. Apply regex pattern
    3. If match, construct object name from template
    4. Return Object with mapped data fields
    """
    pass

def find_or_create_object(
    object_type: str,
    name: str,
    data: Dict[str, Any]
) -> Object:
    """
    Find existing object by type+name, or create new one.
    Objects are deduplicated by (type, name) combination.
    """
    pass
```

#### Manual Object Tagging

```python
def attach_object_to_event(
    event_id: int,
    bucket_id: str,
    object_id: str
) -> None:
    """Manually attach an object to an event."""
    pass

def detach_object_from_event(
    event_id: int,
    bucket_id: str,
    object_id: str
) -> None:
    """Remove object attachment from event."""
    pass

def create_object_manual(
    object_type: str,
    name: str,
    data: Dict[str, Any]
) -> Object:
    """Manually create a new object (not from extraction)."""
    pass
```

#### Object Extraction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     OBJECT EXTRACTION FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Events arrive                                                      │
│       ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Run Extraction Rules (by priority)                       │       │
│  │                                                          │       │
│  │  Rule 1: "PO from title"     → Match "PO-2024-001234"   │       │
│  │  Rule 2: "Order from URL"    → Match "ORD-2024-005678"  │       │
│  │  Rule 3: "Supplier from any" → Match "ACME Corp"        │       │
│  └─────────────────────────────────────────────────────────┘       │
│       ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Find or Create Objects                                   │       │
│  │                                                          │       │
│  │  Object exists?                                          │       │
│  │    YES → Use existing object                            │       │
│  │    NO  → Create new object                              │       │
│  └─────────────────────────────────────────────────────────┘       │
│       ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Link Objects to Event                                    │       │
│  │                                                          │       │
│  │  event_objects: (event_id, bucket_id, object_id)        │       │
│  └─────────────────────────────────────────────────────────┘       │
│       ↓                                                             │
│  User can also manually:                                            │
│    • Attach additional objects                                      │
│    • Remove incorrect attachments                                   │
│    • Create new objects                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pattern Mining Implementation

### Location: `aw-core/aw_mining/`

#### Sequential Pattern Detection

```python
# aw-core/aw_mining/patterns.py

def detect_sequential_patterns(
    events: List[Event],
    min_support: float = 0.1,      # Minimum frequency
    min_length: int = 2,           # Minimum pattern length
    max_length: int = 10,          # Maximum pattern length
    max_gap_seconds: int = 120,    # Maximum gap between events (default 120s)
    key: str = "app"               # Field to use for pattern
) -> List[SequentialPattern]:
    """
    Detect frequently occurring sequential patterns in events.
    Uses algorithms like PrefixSpan or GSP.

    Returns patterns sorted by frequency/support.
    """
    pass

class SequentialPattern:
    sequence: List[str]           # e.g., ["VSCode", "Chrome", "Terminal"]
    support: float                # Frequency (0-1)
    occurrences: int              # Number of times found
    avg_duration: float           # Average total duration
    events: List[List[Event]]     # Actual events for each occurrence
```

#### Event Grouping

```python
# aw-core/aw_mining/grouping.py

def group_events_by_gap(
    events: List[Event],
    max_gap: timedelta = timedelta(seconds=120)  # Default 120 seconds
) -> List[List[Event]]:
    """Group events that occur within max_gap of each other."""
    pass

def group_events_by_session(
    events: List[Event],
    afk_events: List[Event]
) -> List[List[Event]]:
    """Group events into sessions based on AFK detection."""
    pass

def group_events_by_pattern(
    events: List[Event],
    pattern: SequentialPattern
) -> List[List[Event]]:
    """Find all occurrences of a pattern and return grouped events."""
    pass
```

#### Workflow Discovery

```python
# aw-core/aw_mining/workflows.py

def discover_workflows(
    events: List[Event],
    min_occurrences: int = 3,
    similarity_threshold: float = 0.8
) -> List[Workflow]:
    """
    Discover recurring workflow patterns.
    Uses clustering and sequence alignment.
    """
    pass

def match_workflow(
    events: List[Event],
    workflow: Workflow
) -> List[WorkflowOccurrence]:
    """Find occurrences of a workflow pattern in events."""
    pass
```

---

## Query Language Extensions

Add new functions to `aw-core/aw_query/functions.py`:

```python
# Pattern mining functions
mining_sequential_patterns(events, min_support, key, max_gap_seconds=120)
mining_group_by_gap(events, max_gap_seconds=120)
mining_group_by_session(events, afk_events)
mining_discover_workflows(events, min_occurrences)
mining_match_workflow(events, workflow_id)

# Object functions
attach_object(event, object_id)
get_events_by_object(object_id, start, end)
get_objects_by_event(event)
```

---

## WebUI Components (PMTk-Inspired)

### Navigation Structure

```
Process Discovery
├── Variant Explorer     # Discover and compare process variants
├── Process Map          # Interactive flow diagram
└── Process Model        # Saved/defined process models

Visual Analytics
├── Performance View     # Timeline bottleneck analysis
├── Calendar View        # Activity calendar heatmap
├── Transition Matrix    # Activity transition frequencies
└── (existing views)     # Timeline, Activity, etc.

Objects
├── Objects List         # All objects with filtering
└── Object Detail        # Object-centric activity view
```

### Process Discovery Views

#### 1. Variant Explorer (`/process-discovery/variants`)
**File:** `aw-webui/src/views/VariantExplorer.vue`

PMTk-style variant list showing discovered process patterns:

```
┌─────────────────────────────────────────────────────────────────────┐
│ VARIANT EXPLORER                          ▽ Filter Log  ⚙️ Config  │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ 7 variants selected                                    Legend     │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ 56,482 Cases  │ VSCode → Chrome → Terminal → VSCode │  ● VSCode  │
│   38.44% Log    │ [green]  [blue]   [gray]    [green] │  ● Chrome  │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ 46,371 Cases  │ VSCode → Slack                      │  ● Terminal│
│   31.55% Log    │ [green]  [purple]                   │  ● Slack   │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ 20,385 Cases  │ Chrome → VSCode                     │  ● Email   │
│   13.87% Log    │ [blue]   [green]                    │            │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- Horizontal colored boxes for each activity in sequence
- Case count and percentage of total log
- Multi-select variants for comparison
- Legend with activity colors (by app/category)
- Click variant to drill down to occurrences
- Filter by time range, min cases, activity contains
- "Save as Process Model" action for selected variants

#### 2. Process Map (`/process-discovery/map`)
**File:** `aw-webui/src/views/ProcessMap.vue`

Interactive flow diagram showing activity transitions:

```
┌─────────────────────────────────────────────────────────────────────┐
│ PROCESS MAP                               ▶ Play  ▽ Filter  ⚙️     │
├─────────────────────────────────────────────────────────────────────┤
│                                           │ Configuration          │
│              ┌─────────┐                  │                        │
│      150,370→│ VSCode  │                  │ % Activities ━━━━● 90  │
│              │ 150,370 │                  │                        │
│              └────┬────┘                  │ % Paths      ━━━● 30   │
│           103,396 │                       │                        │
│              ┌────▼────┐                  │ ☐ Apply Dependency     │
│      46,952→ │ Chrome  │ ←79,757          │   Threshold            │
│              │ 103,987 │                  │                        │
│              └────┬────┘                  │ Arc Decoration         │
│            18,649 │                       │ ● Frequency            │
│              ┌────▼────┐                  │ ○ Performance          │
│              │Terminal │                  │ ○ Case Percentage      │
│              │ 72,611  │                  │                        │
│              └─────────┘                  │ Node Color             │
│                                           │ [App ▼]                │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- Directed graph with activity nodes
- Edge thickness = transition frequency
- Edge labels = frequency count or duration
- Node size = activity frequency
- Configurable % Activities (filter low-frequency)
- Configurable % Paths (filter low-frequency transitions)
- Arc decoration: frequency, performance (duration), or case %
- Node coloring by app, category, or custom
- Pan/zoom, click node to filter
- Animation: replay process flow

#### 3. Process Model (`/process-discovery/models`)
**File:** `aw-webui/src/views/ProcessModel.vue`

Saved process definitions with monitoring:

- List of saved process models
- For each model: name, pattern, occurrence stats
- Compare actual vs expected process flow
- Conformance checking (how well do cases follow the model?)
- Click to view detailed occurrences

### Visual Analytics Views

#### 4. Performance View (`/analytics/performance`)
**File:** `aw-webui/src/views/PerformanceView.vue`

Timeline spaghetti diagram for bottleneck analysis:

```
┌─────────────────────────────────────────────────────────────────────┐
│ PERFORMANCE VIEW                     Case ID: session_12345        │
├─────────────────────────────────────────────────────────────────────┤
│ Jan 6, 10:30 AM    Jan 6, 11:15 AM    Jan 6, 2:30 PM               │
│ ┌──────────┐       ┌──────────┐       ┌──────────┐                 │
│ │  VSCode  │───────│  Chrome  │───────│  VSCode  │    ← Selected   │
│ └──────────┘  45m  └──────────┘  3h   └──────────┘      case       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ VSCode     ══════╗     ╔════════════════╗    ╔══════               │
│            ══════╬═════╬════════════════╬════╬══════               │
│ Chrome           ╠═════╣                ╠════╣        ← Spaghetti  │
│            ══════╬═════╬════════════════╬════╬══════     diagram   │
│ Terminal   ══════╝     ╚════════════════╝    ╚══════               │
│                                                                     │
│ ──────────┬──────────┬──────────┬──────────┬──────────             │
│        Feb 2018   Apr 2018   Jun 2018   Aug 2018                   │
├─────────────────────────────────────────────────────────────────────┤
│ Activity 1: VSCode           Activity 2: Chrome                    │
│ Duration between: Min 1h 31m ━━━━━━━━━━━━━━━━● Max 5h 22m         │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- X-axis = time, Y-axis = activities
- Lines connect sequential activities per case/session
- Color-coded by duration (green=fast, red=slow)
- Highlight individual case path on hover/click
- Duration distribution between activity pairs
- Identify bottlenecks (where lines bunch up)
- Filter by date range, duration threshold

#### 5. Transition Matrix (`/analytics/transitions`)
**File:** `aw-webui/src/views/TransitionMatrix.vue`

Heatmap of activity-to-activity transitions:

```
         │ VSCode │ Chrome │ Terminal │ Slack │
─────────┼────────┼────────┼──────────┼───────┤
VSCode   │   -    │  42%   │   28%    │  15%  │
Chrome   │  35%   │   -    │   12%    │   8%  │
Terminal │  45%   │  18%   │    -     │   2%  │
Slack    │  22%   │  31%   │    5%    │   -   │
```

Features:
- Row = source activity, Column = target activity
- Cell value = transition frequency or probability
- Color intensity = frequency
- Click cell to see specific transitions

### Object Views

#### 6. Objects View (`/objects`)
**File:** `aw-webui/src/views/Objects.vue`

- Object type filter (projects, tasks, customers, etc.)
- Object list with attached event/step/workflow counts
- Search/filter by name, type, metadata

#### 7. Object Detail View (`/objects/:id`)
**File:** `aw-webui/src/views/ObjectDetail.vue`

- Timeline of all activity related to this object
- Process variants involving this object
- Duration statistics
- Related objects

### Drill-Down Views

#### 8. Case Explorer (`/cases/:id`)
**File:** `aw-webui/src/views/CaseExplorer.vue`

Detailed view of a single process occurrence:

```
Case: session_2024-01-06_10:30
Duration: 2h 15m
Objects: [Project: MyApp] [Sprint: 23]

Timeline:
├── 10:30 VSCode - main.ts (5 min)
│   └── Objects: [File: main.ts]
├── 10:35 VSCode - test.ts (8 min)
├── 10:43 Chrome - GitHub PR #123 (15 min)
│   └── Objects: [PR: #123]
├── 10:58 Slack - #dev-team (12 min)
└── 11:10 VSCode - main.ts (25 min)
```

### New Components

#### VariantRow
**File:** `aw-webui/src/components/VariantRow.vue`
- Horizontal sequence of colored activity boxes
- Case count badge
- Percentage bar
- Checkbox for selection

#### ProcessGraph
**File:** `aw-webui/src/components/ProcessGraph.vue`
- D3.js or vis.js based directed graph
- Draggable nodes
- Zoomable/pannable canvas
- Edge thickness/color based on metrics
- Node tooltips with statistics

#### PerformanceSpaghetti
**File:** `aw-webui/src/components/PerformanceSpaghetti.vue`
- SVG-based spaghetti diagram
- Horizontal time axis
- Activity swimlanes
- Curved paths connecting activities
- Color gradient by duration
- Hover to highlight single case

#### TransitionHeatmap
**File:** `aw-webui/src/components/TransitionHeatmap.vue`
- Grid-based heatmap
- Color scale legend
- Row/column sorting
- Click to drill down

#### ActivityLegend
**File:** `aw-webui/src/components/ActivityLegend.vue`
- Colored dots with activity names
- Toggle visibility
- Filter by clicking

#### Hierarchical Event Tree
**File:** `aw-webui/src/components/HierarchicalEventTree.vue`
- Collapsible tree: Process → Steps → Events
- Duration at each level
- Object badges
- Click to expand/drill-down

#### Object Attachment Widget
**File:** `aw-webui/src/components/ObjectAttachment.vue`
- Autocomplete object search
- Quick-add object button
- Attached objects list with remove option
- Works for events, steps, and workflows

### New Stores

#### Mining Store
**File:** `aw-webui/src/stores/mining.ts`
```typescript
interface MiningStore {
  patterns: SequentialPattern[]
  discoveredWorkflows: Workflow[]

  // Actions
  detectPatterns(options: PatternOptions): Promise<SequentialPattern[]>
  groupEvents(options: GroupingOptions): Promise<EventGroup[]>
  discoverWorkflows(options: DiscoveryOptions): Promise<Workflow[]>
}
```

#### Workflows Store
**File:** `aw-webui/src/stores/workflows.ts`
```typescript
interface WorkflowsStore {
  workflows: Workflow[]
  selectedWorkflow: Workflow | null
  occurrences: WorkflowOccurrence[]

  // Actions
  fetchWorkflows(): Promise<void>
  createWorkflow(workflow: Workflow): Promise<Workflow>
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void>
  deleteWorkflow(id: string): Promise<void>
  fetchOccurrences(workflowId: string): Promise<WorkflowOccurrence[]>
  attachObject(workflowId: string, objectId: string): Promise<void>
}
```

#### Objects Store
**File:** `aw-webui/src/stores/objects.ts`
```typescript
interface ObjectsStore {
  objects: Object[]
  objectTypes: string[]

  // Actions
  fetchObjects(type?: string): Promise<void>
  createObject(obj: Object): Promise<Object>
  updateObject(id: string, updates: Partial<Object>): Promise<void>
  deleteObject(id: string): Promise<void>
  attachToEvent(eventId: string, bucketId: string, objectId: string): Promise<void>
  attachToStep(stepId: string, objectId: string): Promise<void>
  attachToWorkflow(workflowId: string, objectId: string): Promise<void>
}
```

---

## Implementation Phases

### Phase 1: Core Data Model (Backend)
1. Add Object, Step, Workflow models to `aw-core`
2. Add database schema migrations
3. Implement CRUD operations in datastore
4. Add event object_ids field

**Files to modify:**
- `aw-core/aw_core/models.py`
- `aw-core/aw_core/schemas/` (new JSON schemas)
- `aw-core/aw_datastore/datastore.py`
- `aw-core/aw_datastore/storages/` (SQLite/PostgreSQL implementations)

### Phase 2: Mining Algorithms (Backend)
1. Create `aw-core/aw_mining/` module
2. Implement sequential pattern detection
3. Implement event grouping algorithms
4. Implement workflow discovery

**New files:**
- `aw-core/aw_mining/__init__.py`
- `aw-core/aw_mining/patterns.py`
- `aw-core/aw_mining/grouping.py`
- `aw-core/aw_mining/workflows.py`

### Phase 3: REST API (Backend)
1. Add Objects API endpoints
2. Add Steps API endpoints
3. Add Workflows API endpoints
4. Add Mining API endpoints

**Files to modify:**
- `aw-server/aw_server/rest.py`
- `aw-server/aw_server/api.py`

### Phase 4: Query Language (Backend)
1. Add mining query functions
2. Add object-related query functions

**Files to modify:**
- `aw-core/aw_query/functions.py`

### Phase 5: WebUI - Stores & API Client
1. Create mining store (patterns, variants, transitions)
2. Create process models store (saved processes)
3. Create objects store
4. Extend API client with new endpoints

**New files:**
- `aw-webui/src/stores/mining.ts`
- `aw-webui/src/stores/processModels.ts`
- `aw-webui/src/stores/objects.ts`

### Phase 6: WebUI - Process Discovery Views
1. Variant Explorer (PMTk-style variant list)
2. Process Map (interactive flow diagram)
3. Process Model (saved process definitions)

**New files:**
- `aw-webui/src/views/VariantExplorer.vue`
- `aw-webui/src/views/ProcessMap.vue`
- `aw-webui/src/views/ProcessModel.vue`

### Phase 7: WebUI - Analytics Views
1. Performance View (spaghetti diagram)
2. Transition Matrix (heatmap)
3. Case Explorer (drill-down)
4. Objects views

**New files:**
- `aw-webui/src/views/PerformanceView.vue`
- `aw-webui/src/views/TransitionMatrix.vue`
- `aw-webui/src/views/CaseExplorer.vue`
- `aw-webui/src/views/Objects.vue`
- `aw-webui/src/views/ObjectDetail.vue`

### Phase 8: WebUI - Components
1. VariantRow (horizontal activity sequence)
2. ProcessGraph (D3/vis.js flow diagram)
3. PerformanceSpaghetti (timeline diagram)
4. TransitionHeatmap
5. ActivityLegend
6. HierarchicalEventTree
7. ObjectAttachment widget

**New files:**
- `aw-webui/src/components/VariantRow.vue`
- `aw-webui/src/components/ProcessGraph.vue`
- `aw-webui/src/components/PerformanceSpaghetti.vue`
- `aw-webui/src/components/TransitionHeatmap.vue`
- `aw-webui/src/components/ActivityLegend.vue`
- `aw-webui/src/components/HierarchicalEventTree.vue`
- `aw-webui/src/components/ObjectAttachment.vue`

### Phase 9: Integration & Polish
1. Add navigation menu items (Process Discovery, Visual Analytics, Objects)
2. Cross-link between views (variant → cases, process map → case explorer)
3. Filter log functionality (global time range, activity filters)
4. Add object attachment to existing event views
5. Performance optimization

---

## Key Design Decisions

### 1. Objects are First-Class Entities
Objects are stored independently and referenced via IDs, allowing:
- Same object attached to multiple events/steps/workflows
- Object-centric activity views
- Flexible object types (projects, tasks, customers, etc.)

### 2. Steps as Grouping Mechanism
Steps bridge events and workflows:
- Provide meaningful groupings of related events
- Can exist independently of workflows
- Enable step-level analysis and object attachment

### 3. Pattern vs Occurrence Separation
Workflows store the pattern definition separately from occurrences:
- Pattern: The abstract sequence to match
- Occurrences: Actual instances found in data
- Allows re-mining without losing saved patterns

### 4. Hierarchical Drill-Down
UI supports three levels of detail:
- Workflow level: Overview and statistics
- Step level: Grouped activity breakdown
- Event level: Raw event data

### 5. Backward Compatibility
Existing functionality remains unchanged:
- Events still work without object attachments
- Query language extended, not replaced
- Timeline and activity views unaffected

---

## Design Decisions (Confirmed)

1. **Object Type System**: User-definable object types (flexible schema)

2. **Pattern Matching Flexibility**: Allow gaps up to configurable threshold (default: 120 seconds)

3. **Discovery Method**: Process mining automatically identifies patterns; user can save/refine

4. **Cross-Device Support**: Single device only (not in scope for initial implementation)

5. **Mining Trigger**: On-demand (user triggers analysis, not continuous background processing)
