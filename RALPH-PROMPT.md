# Enterprise Activity Intelligence Platform - Ralph Implementation Prompt

## Goal
Build "Palantir for E-commerce" - an activity intelligence platform on top of ActivityWatch.

## Full Plan
See: `/Users/hvejsel/.claude/plans/federated-dancing-hare.md`

## Implementation Checklist

Work through these steps in order. Check off completed items by changing `[ ]` to `[x]`.

### Phase 1: Next.js Frontend Foundation
- [x] 1.1 Create `/aw-webui-next/` with `npx create-next-app@latest`
- [x] 1.2 Install dependencies: `shadcn/ui`, `tailwindcss`, `@tanstack/react-query`, `cytoscape`
- [x] 1.3 Create app structure: `src/app/` with layout.tsx, page.tsx
- [x] 1.4 Create pages: `/events`, `/processes`, `/processes/[id]`, `/objects`, `/objects/training`, `/settings`, `/settings/llm`, `/settings/detection`
- [x] 1.5 Create basic navigation component

### Phase 2: Dashboard Page
- [x] 2.1 Create ActivityWatch API client at `src/lib/aw-client.ts`
- [x] 2.2 Create dashboard page with activity summary
- [x] 2.3 Add key metrics cards (active time, top apps, processes detected)

### Phase 3: Settings Pages
- [x] 3.1 Create settings layout with sidebar navigation
- [x] 3.2 LLM settings page (`/settings/llm`) - provider selection, model, API keys
- [x] 3.3 Detection settings page (`/settings/detection`) - patterns, thresholds
- [x] 3.4 General settings page - privacy filters, intervals

### Phase 4: Event Explorer
- [x] 4.1 Create EventList component with table
- [x] 4.2 Add screenshot viewer component
- [x] 4.3 Add filtering by bucket, date range, search
- [x] 4.4 Show detected objects on events

### Phase 5: Server-Side Object Detection
- [x] 5.1 Create `/aw-server/aw_server/taskmining/object_detector.py` - universal detector
- [x] 5.2 Add detection for window titles, URLs, OCR text
- [x] 5.3 Hook into event insertion to detect objects on all watchers

### Phase 6: LLM Analysis Service
- [x] 6.1 Create `/aw-server/aw_server/taskmining/llm_service.py`
- [x] 6.2 Add Ollama provider (Qwen2.5-VL, LLaVA)
- [x] 6.3 Add Claude provider as fallback
- [x] 6.4 Add async queue for non-blocking analysis

### Phase 7: Trainable Ontology
- [ ] 7.1 Create `/aw-server/aw_server/taskmining/ontology.py`
- [ ] 7.2 Implement confirm/reject pattern learning
- [ ] 7.3 Add pattern generalization (extract regex from confirmed matches)
- [ ] 7.4 Add confidence scoring

### Phase 8: Object Training UI
- [ ] 8.1 Create ObjectConfirmation component (confirm/reject/correct)
- [x] 8.2 Create training queue page (`/objects/training`)
- [ ] 8.3 Add bulk review mode
- [ ] 8.4 Add pattern editor for power users

### Phase 9: Process List Page
- [x] 9.1 Create process list page (`/processes`)
- [ ] 9.2 Show process cards with stats (runs, duration, variants)
- [ ] 9.3 Add filtering and search

### Phase 10: Process Detail Page
- [x] 10.1 Create process detail page (`/processes/[id]`)
- [x] 10.2 Add overview card (name, executions, duration)
- [ ] 10.3 Add process flow graph (Cytoscape.js)
- [ ] 10.4 Add steps table with variants
- [x] 10.5 Add linked objects section (products, orders, customers)
- [x] 10.6 Add instances list with replay capability

### Phase 11: User Prompting
- [ ] 11.1 Create `/aw-server/aw_server/taskmining/prompting.py`
- [ ] 11.2 Implement ambiguity detection
- [ ] 11.3 Create DecisionPrompt component in frontend
- [ ] 11.4 Add prompt queue with toast notifications

### Phase 12: Browser Extension Network Capture
- [ ] 12.1 Add networkTracker.ts to `/aw-watcher-web-firtal/src/background/`
- [ ] 12.2 Intercept fetch and XMLHttpRequest
- [ ] 12.3 Extract business objects from API responses
- [ ] 12.4 Create `api_call` event type

## Current Progress

Check the checkboxes above to see what's done. Look at the git history and file system to understand previous iterations.

## Success Criteria

Output this when ALL checkboxes are checked:
```
<promise>IMPLEMENTATION COMPLETE</promise>
```

## Instructions for Each Iteration

1. Read this file and the full plan
2. Check git status and existing files to see what's already done
3. Work on the NEXT unchecked item
4. After completing work, update the checkbox to `[x]`
5. Commit your changes with a descriptive message
6. If all items are done, output the promise tag
