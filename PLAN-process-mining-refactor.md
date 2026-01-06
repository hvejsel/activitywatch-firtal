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
An entity that can be attached to events, steps, or workflows.

```python
# aw-core/aw_core/models.py
class Object(dict):
    id: str                    # Unique identifier (UUID)
    name: str                  # Display name
    type: str                  # Object type (e.g., "project", "task", "customer", "ticket")
    data: Dict[str, Any]       # Custom metadata
    created: datetime
    updated: datetime
```

#### 2. Step
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

#### 3. Workflow (Process)
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

#### 4. Event Extension
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
-- Objects table
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSON,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL
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

### Objects API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/0/objects` | List all objects (with filtering by type) |
| POST | `/api/0/objects` | Create new object |
| GET | `/api/0/objects/<id>` | Get object by ID |
| PUT | `/api/0/objects/<id>` | Update object |
| DELETE | `/api/0/objects/<id>` | Delete object |

### Object Attachments API

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

## WebUI Components

### New Views

#### 1. Process Mining Dashboard (`/mining`)
**File:** `aw-webui/src/views/ProcessMining.vue`

- Pattern discovery interface
- Discovered patterns list with:
  - Pattern sequence visualization
  - Frequency/support metrics
  - "Save as Workflow" action
- Event grouping controls
- Workflow creation from patterns

#### 2. Workflows View (`/workflows`)
**File:** `aw-webui/src/views/Workflows.vue`

- List of saved workflows
- For each workflow:
  - Name, description, pattern visualization
  - Occurrence count and total duration
  - Object attachments
- Actions: View details, edit, delete, measure

#### 3. Workflow Detail View (`/workflows/:id`)
**File:** `aw-webui/src/views/WorkflowDetail.vue`

Hierarchical drill-down interface:

```
Workflow: "Code Review Process"
├── Objects: [Project: MyApp, Sprint: 23]
├── Pattern: VSCode → Chrome (PR) → Slack → VSCode
├── Statistics:
│   ├── Occurrences: 47
│   ├── Avg Duration: 25 min
│   └── Total Time: 19.5 hours
│
└── Occurrences:
    ├── [2024-01-06 10:30] (32 min)
    │   ├── Step 1: Open IDE (8 min)
    │   │   ├── Event: VSCode - project.ts [10:30-10:35]
    │   │   ├── Event: VSCode - test.ts [10:35-10:38]
    │   │   └── Objects: [File: project.ts]
    │   ├── Step 2: Review PR (15 min)
    │   │   └── Events: ...
    │   └── Step 3: Discuss (9 min)
    │       └── Events: ...
    │
    ├── [2024-01-05 14:20] (28 min)
    │   └── ...
```

#### 4. Objects View (`/objects`)
**File:** `aw-webui/src/views/Objects.vue`

- Object type filter (projects, tasks, customers, etc.)
- Object list with attached event/step/workflow counts
- Object detail showing all related activity

#### 5. Object Detail View (`/objects/:id`)
**File:** `aw-webui/src/views/ObjectDetail.vue`

- Timeline of all activity related to object
- Breakdown by workflow/step/event
- Duration statistics

### New Components

#### Pattern Visualizer
**File:** `aw-webui/src/components/PatternVisualizer.vue`
- Flow diagram showing sequence of activities
- Node colors by app/category
- Edge annotations for transitions

#### Hierarchical Event Tree
**File:** `aw-webui/src/components/HierarchicalEventTree.vue`
- Collapsible tree: Workflow → Steps → Events
- Duration at each level
- Object badges
- Click to expand/drill-down

#### Object Attachment Widget
**File:** `aw-webui/src/components/ObjectAttachment.vue`
- Autocomplete object search
- Quick-add object button
- Attached objects list with remove option
- Works for events, steps, and workflows

#### Occurrence Timeline
**File:** `aw-webui/src/components/OccurrenceTimeline.vue`
- Visual timeline of workflow occurrences
- Stacked bar chart showing step breakdown
- Hover for details

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
1. Create mining store
2. Create workflows store
3. Create objects store
4. Extend API client with new endpoints

**New files:**
- `aw-webui/src/stores/mining.ts`
- `aw-webui/src/stores/workflows.ts`
- `aw-webui/src/stores/objects.ts`

### Phase 6: WebUI - Views
1. Process Mining Dashboard
2. Workflows list view
3. Workflow detail view with drill-down
4. Objects list and detail views

**New files:**
- `aw-webui/src/views/ProcessMining.vue`
- `aw-webui/src/views/Workflows.vue`
- `aw-webui/src/views/WorkflowDetail.vue`
- `aw-webui/src/views/Objects.vue`
- `aw-webui/src/views/ObjectDetail.vue`

### Phase 7: WebUI - Components
1. Pattern visualizer
2. Hierarchical event tree
3. Object attachment widget
4. Occurrence timeline

**New files:**
- `aw-webui/src/components/PatternVisualizer.vue`
- `aw-webui/src/components/HierarchicalEventTree.vue`
- `aw-webui/src/components/ObjectAttachment.vue`
- `aw-webui/src/components/OccurrenceTimeline.vue`

### Phase 8: Integration & Polish
1. Add navigation menu items
2. Cross-link between views
3. Add object attachment to existing event views
4. Performance optimization

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
