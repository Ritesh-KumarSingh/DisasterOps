# Disaster Response Coordination System — Coding Agent Build Plan

> **Timebox:** 48 hours | **Team:** 4 people on 4 parallel tracks  
> **Stack:** FastAPI · SQLite · React · Leaflet · Python · pytest  
> **Goal:** A working demo with live map, greedy allocator, scenario runner, operator override, and KPI dashboard.

---

## How to use this file

Work through the steps in order within each track. Tracks A–D run in parallel. Two hard sync points exist at **Hour 12** and **Hour 32** — all tracks must have completed their listed sync deliverables before those checkpoints. Read the **Shared Contracts** section first before writing any code.

---

## Shared Contracts (read before writing any code)

### Canonical JSON schemas

All four schemas below must be used exactly as defined. Do not rename fields.

**Incident**
```json
{
  "id": "inc_001",
  "type": "flood",
  "severity": 3,
  "lat": 28.6139,
  "lng": 77.2090,
  "location_desc": "Sector 12, near underpass",
  "reported_at": "2024-01-15T09:14:00Z",
  "status": "open",
  "priority_score": 84,
  "assigned_resource_id": null,
  "score_breakdown": {
    "severity": 30,
    "population_density": 25,
    "proximity_to_resource": 18,
    "infra_criticality": 11
  }
}
```

**Resource**
```json
{
  "id": "res_amb_03",
  "agency": "ambulance",
  "unit_name": "Ambulance 3",
  "capacity": 2,
  "current_load": 0,
  "status": "available",
  "lat": 28.6200,
  "lng": 77.2150,
  "eta_minutes": null,
  "skills": ["medical", "extraction"]
}
```

**Assignment**
```json
{
  "id": "asgn_007",
  "incident_id": "inc_001",
  "resource_id": "res_amb_03",
  "created_at": "2024-01-15T09:15:22Z",
  "eta_minutes": 7,
  "status": "en_route",
  "override_by_operator": false,
  "reason": "Nearest available unit with medical skill; score 84"
}
```

**Hazard zone**
```json
{
  "id": "hz_001",
  "type": "flood",
  "risk_level": 0.8,
  "polygon": [[28.61, 77.20], [28.62, 77.21], [28.60, 77.22]]
}
```

**Scenario tick** (used inside scenario manifest files)
```json
{
  "tick": 3,
  "new_incidents": [{ "...incident fields..." }],
  "hazard_updates": [{ "id": "hz_001", "polygon": [[28.61, 77.20]] }]
}
```

---

### API contract

| Endpoint | Method | Priority | Request body / notes |
|---|---|---|---|
| `/map-state` | GET | Must | Returns `{incidents[], resources[], hazard_zones[]}` |
| `/incidents` | POST | Must | Body: `{type, severity, lat, lng, location_desc}` → returns new incident with computed score |
| `/assign` | POST | Must | Body: `{incident_id}` → runs allocator, returns assignment |
| `/assignments/{id}/override` | POST | Must | Body: `{resource_id}` → reassigns, sets `override_by_operator: true` |
| `/scenarios/{name}/start` | POST | Must | `name` is `flood`, `wildfire`, or `quake` → starts tick replay |
| `/kpis` | GET | Must | Returns `{avg_response_time, utilization_rate, open_by_severity{}}` |
| `/events?since={timestamp}` | GET | Nice | Returns events since timestamp — polling fallback |
| `ws://…/events` | WebSocket | Nice | Pushes `{type, payload}` on state changes |

Use environment variable `API_BASE_URL` (default `http://localhost:8000`) in the frontend. Never hardcode `localhost`.

---

### Priority scoring formula

```
score = (severity_norm × 0.35 + density_index × 0.25 + proximity_norm × 0.25 + infra_weight × 0.15) × 100
```

| Parameter | Range | How to compute |
|---|---|---|
| `severity_norm` | 0–1 | `incident.severity / 5` |
| `density_index` | 0–1 | Population density at location, normalized (use static lookup per zone in seed data) |
| `proximity_norm` | 0–1 | `1 - (distance_to_nearest_unit_km / 20)` — clamp to 0 if > 20 km |
| `infra_weight` | 0–1 | Static tag: hospital = 1.0, main road = 0.5, residential = 0.2 |

Weights must be tunable — store them in a `WEIGHTS` dict, not hardcoded. Score is always rounded to nearest integer.

---

## Track A — Backend (FastAPI + allocator engine)

**Owner:** Backend lead  
**Branch:** `track/backend`  
**Total estimated hours:** ~26 of 48

---

### Step A-1 — Project scaffold `[Hours 0–2]` `[Must]`

1. Create a new directory `backend/`.
2. Initialize a Python virtual environment and install: `fastapi`, `uvicorn`, `sqlite3` (stdlib), `pytest`, `httpx`.
3. Create `backend/main.py` with a bare FastAPI app that returns `{"status": "ok"}` on `GET /`.
4. Create `backend/state.py` — this is the single in-memory state store. Define three dicts: `INCIDENTS = {}`, `RESOURCES = {}`, `ASSIGNMENTS = {}`. Also define `HAZARD_ZONES = []`.
5. Create `backend/config.py` — define `WEIGHTS = {"severity": 0.35, "density": 0.25, "proximity": 0.25, "infra": 0.15}` and `SCENARIO_TICK_INTERVAL_SECONDS = 5`.
6. Verify server starts: `uvicorn main:app --reload` from `backend/`.

**Acceptance:** `GET /` returns 200 and `{"status": "ok"}`.

---

### Step A-2 — Seed loader `[Hours 2–3]` `[Must]`

1. On app startup, read `data/seed_data.json` (produced by Track C — use a placeholder file with 2 incidents and 2 resources if Track C hasn't delivered yet).
2. Populate `state.INCIDENTS`, `state.RESOURCES`, `state.HAZARD_ZONES` from the file.
3. Add `GET /map-state` endpoint that returns all three collections as lists.

**Acceptance:** `GET /map-state` returns valid JSON with incidents, resources, and hazard zones from the seed file.

**Sync point H12 deliverable:** `/map-state` must be live and returning seed data.

---

### Step A-3 — Priority scoring function `[Hours 3–6]` `[Must]`

1. Create `backend/scoring.py`.
2. Implement `score_incident(incident, resources, weights)`:
   - Compute `severity_norm = incident["severity"] / 5`.
   - Compute `proximity_norm`: find the nearest `available` resource using Haversine distance. If none, set to 0.
   - Use `incident["density_index"]` and `incident["infra_weight"]` directly from the incident object (these come from seed data).
   - Apply the formula from the contract section above.
   - Return an integer score plus a `score_breakdown` dict.
3. Call this function every time an incident is created or updated.

**Acceptance:** Unit test — an incident with `severity=5`, `density_index=1.0`, `proximity_norm=1.0`, `infra_weight=1.0` scores 100. An incident with all zeros scores 0.

---

### Step A-4 — Greedy allocator `[Hours 6–10]` `[Must]`

1. Create `backend/allocator.py`.
2. Implement `allocate(incident_id, state, weights)`:
   - Look up the incident by ID.
   - Filter resources: `status == "available"` and `skills` intersects `incident["required_skills"]`.
   - Among eligible resources, find the one with minimum Haversine distance to the incident.
   - If no eligible resource found, return `{"status": "no_unit_available", "incident_id": incident_id}`.
   - Otherwise: create an Assignment object (use the canonical schema), set resource `status = "busy"`, set incident `assigned_resource_id`, compute ETA as `distance_km / 0.5` (assume 30 km/h avg speed in emergency), store in `state.ASSIGNMENTS`.
   - Return the assignment.
3. Add `POST /assign` endpoint that calls `allocate()`.

**Acceptance:** Unit test — given 3 resources, allocator picks the closest one with matching skills. A resource with wrong skills is skipped even if nearer.

---

### Step A-5 — Incident creation endpoint `[Hours 10–12]` `[Must]`

1. Add `POST /incidents` endpoint.
2. Validate body fields: `type`, `severity` (1–5), `lat`, `lng`. `location_desc` is optional.
3. Generate a unique ID (`inc_` + timestamp + short random suffix).
4. Score the incident immediately using `scoring.score_incident()`.
5. Store in `state.INCIDENTS`.
6. Return the full incident object.

**Acceptance:** Posting a new incident returns 200 with a `priority_score` computed. It appears in the next `GET /map-state` response.

---

### Step A-6 — Assignment endpoints `[Hours 12–16]` `[Must]`

1. Add `GET /assignments` — returns all assignments as a list.
2. Add `POST /assignments/{id}/override`:
   - Accept body `{"resource_id": "..."}`.
   - Release the old resource back to `status = "available"`.
   - Run the allocator logic with the specific resource forced (skip the nearest-search, use the given resource directly).
   - Set `override_by_operator = true` on the new assignment.
   - Append an entry to an append-only `EVENT_LOG` list with timestamp, action `"override"`, operator flag.
   - Return the updated assignment.

**Acceptance:** Override changes the assigned resource. Old resource returns to available. `override_by_operator` is `true` in response.

---

### Step A-7 — Scenario runner `[Hours 16–22]` `[Must]`

1. Create `backend/scenario_runner.py`.
2. Implement `start_scenario(name)`:
   - Load `data/scenarios/{name}.json` (the tick array from Track C).
   - Use Python's `asyncio` background task (FastAPI's `BackgroundTasks`) to replay ticks.
   - Each tick: add `new_incidents` to state (score each one), update `hazard_zones` with `hazard_updates`.
   - Sleep `SCENARIO_TICK_INTERVAL_SECONDS` between ticks.
3. Add `POST /scenarios/{name}/start` endpoint that triggers `start_scenario()`.
4. Only allow `name` values: `flood`, `wildfire`, `quake`. Return 400 for others.

**Acceptance:** Calling `POST /scenarios/flood/start` causes new incidents to appear in `GET /map-state` every 5 seconds matching the flood scenario ticks. Hazard polygon updates are reflected.

---

### Step A-8 — KPI endpoint `[Hours 22–24]` `[Must]`

1. Add `GET /kpis` endpoint.
2. Compute:
   - `avg_response_time`: average `eta_minutes` across all assignments with `status != "no_unit_available"`.
   - `utilization_rate`: `count(resources where status == "busy") / total_resources` as a float 0–1.
   - `open_by_severity`: dict of severity level → count of open incidents at that severity.
3. Return as JSON.

**Acceptance:** After starting a scenario and running a few assigns, `GET /kpis` returns non-zero values for all three fields.

---

### Step A-9 — Polling fallback `[Hours 24–26]` `[Nice]`

1. Maintain a global `EVENT_LOG` list where every state mutation appends `{"timestamp": "...", "type": "...", "payload": {...}}`.
2. Add `GET /events?since={iso_timestamp}` endpoint that filters `EVENT_LOG` to entries after the given timestamp.
3. Frontend can call this every 5 seconds as a fallback instead of WebSocket.

---

### Track A fallback if stuck

- Skip WebSocket and polling endpoint entirely — the frontend can call `GET /map-state` on a timer.
- If SQLite feels slow, keep everything in-memory dicts only.
- If async scenario runner is complex, run ticks synchronously on request: `GET /scenarios/{name}/tick` advances by one tick, frontend calls it manually.

---

## Track B — Frontend (React + Leaflet)

**Owner:** Frontend lead  
**Branch:** `track/frontend`  
**Total estimated hours:** ~28 of 48

---

### Step B-1 — Project scaffold `[Hours 0–2]` `[Must]`

1. In a new directory `frontend/`, run: `npm create vite@latest . -- --template react`.
2. Install: `react-leaflet`, `leaflet`, `axios` (or use native fetch).
3. Create `frontend/.env` with `VITE_API_BASE=http://localhost:8000`.
4. Remove Vite boilerplate. Create a clean `App.jsx` that renders a `<div>Hello</div>`.
5. Verify: `npm run dev` starts without errors.

**Acceptance:** App compiles and renders without errors.

---

### Step B-2 — Map with hard-coded seed data `[Hours 2–6]` `[Must]`

1. Import `seed_data.json` directly into the component (copy from Track C's file, or use 3 placeholder incidents and 2 resources).
2. Render a full-page Leaflet map centered on the seed data's city.
3. For each incident, render a `CircleMarker`. Color by severity: critical (5) = `#E24B4A`, high (4) = `#EF9F27`, medium (3) = `#378ADD`, low (1–2) = `#1D9E75`.
4. For each resource, render a `Marker` with a distinct icon per agency type (use Leaflet's default icons differentiated by color or size).
5. For each hazard zone, render a `Polygon` with semi-transparent fill: flood = blue at 30% opacity, fire = red at 30% opacity.

**Acceptance:** Map renders with markers and polygons from local seed data before any backend connection.

**Sync point H12 deliverable:** Map renders cleanly with seed data.

---

### Step B-3 — Left sidebar `[Hours 6–12]` `[Must]`

1. Add a fixed left sidebar (width 280px).
2. Top section: three scenario launcher buttons — "Flood", "Wildfire", "Earthquake". Clicking each calls `POST /scenarios/{name}/start`. Show a loading state while the request is in flight.
3. Bottom section: a list of incidents, each rendered as a card showing: incident ID (truncated), type badge, severity badge (colored), priority score as a number. Sort by `priority_score` descending.
4. Clicking an incident card opens the right drawer (Step B-4) for that incident.

**Acceptance:** Sidebar renders incident list sorted by score. Scenario buttons are clickable (backend calls may fail gracefully at this stage with a console error).

---

### Step B-4 — Right drawer (incident detail + score breakdown) `[Hours 12–16]` `[Must]`

1. Implement a slide-in drawer from the right (400px wide) that opens when an incident is selected.
2. Show: incident ID, type, severity, location description, reported time, current status, assigned resource ID (or "Unassigned").
3. Below the metadata, show the score breakdown as a horizontal bar chart (pure CSS bars — no chart library needed). Four bars: severity, population density, proximity, infra criticality. Each bar width = `(value / total_score) * 100%`.
4. Show a text explanation: "Assigned because: {assignment.reason}".
5. Add an "Override assignment" section: a dropdown of available resources (fetched from `GET /map-state`), a "Reassign" button that calls `POST /assignments/{id}/override`.
6. Close button or clicking outside the map closes the drawer.

**Acceptance:** Clicking any incident shows its details, score breakdown bars, and the override control.

---

### Step B-5 — Live API polling `[Hours 16–20]` `[Must]`

1. Replace hard-coded seed data import with a `useEffect` that calls `GET /map-state` every 5 seconds.
2. Update the map markers and incident list in real time when data changes.
3. Implement optimistic updates: when a scenario is started, show a "Scenario running..." badge in the sidebar immediately — don't wait for the poll.
4. Handle API errors gracefully: if the fetch fails, show a small "Reconnecting…" indicator, keep the last good state on screen.

**Acceptance:** Starting a flood scenario from the UI causes new markers to appear on the map within 10 seconds without a page reload.

---

### Step B-6 — SOS citizen form `[Hours 20–24]` `[Must]`

1. Add an "SOS Report" button in the top-right corner of the map.
2. Clicking it opens a modal form with:
   - Location: two number inputs for lat/lng, plus a "Use my location" button that calls `navigator.geolocation.getCurrentPosition()`.
   - Incident type: `<select>` with options: flood, fire, medical, structural, other.
   - Severity: radio buttons 1–5 (labeled: 1 = Minor, 3 = Serious, 5 = Critical).
   - Description: `<textarea>` optional.
3. Submit calls `POST /incidents`. On success, close the modal and show a toast: "Report submitted — ID: {incident_id}".
4. New incident should appear on the map within one poll cycle.

**Acceptance:** Submitting the SOS form creates a new incident visible on the map within 5 seconds.

---

### Step B-7 — KPI panel `[Hours 24–28]` `[Nice]`

1. Add a KPI strip below the scenario buttons in the left sidebar.
2. Show three metric cards: "Avg ETA" (minutes), "Utilization" (percentage), "Open incidents" (count).
3. Fetch from `GET /kpis` every 10 seconds.
4. Add a simple priority score histogram: 4 bars for severity levels 1–2, 3, 4, 5. Bar height = count of open incidents at that level.

**Acceptance:** KPI values update live during a running scenario.

---

### Step B-8 — Responder list view `[Hours 28–32]` `[Nice]`

1. Add a second tab in the left sidebar: "Resources".
2. Show each resource as a row: unit name, agency badge, status badge (available = green, busy = amber), current assignment ID if busy.
3. Clicking a busy resource opens the right drawer showing the incident it's assigned to.

---

### Track B fallback if stuck

- Drop the KPI histogram — show plain numbers only.
- Drop the responder list tab.
- If right drawer CSS is complex, use a simple `alert()` to show score breakdown during demo.
- If `react-leaflet` has lifecycle issues, switch to a plain Leaflet map in a `useRef` effect.

---

## Track C — Data & Simulation

**Owner:** Data engineer  
**Branch:** `track/data`  
**Total estimated hours:** ~22 of 48

---

### Step C-1 — Agree scenario manifest format with Track A `[Hour 0–1]` `[Must]`

Before writing any data files, confirm the tick format with Track A. The agreed format is:

```json
{
  "scenario": "flood",
  "description": "Urban flash flood in low-lying sectors",
  "ticks": [
    {
      "tick": 1,
      "delay_seconds": 0,
      "new_incidents": [ { "...full incident object without id/score..." } ],
      "hazard_updates": [ { "id": "hz_001", "polygon": [ [...] ] } ]
    }
  ]
}
```

Each incident in `new_incidents` must include: `type`, `severity`, `lat`, `lng`, `location_desc`, `density_index`, `infra_weight`, `required_skills`. The backend will auto-assign `id`, `reported_at`, and `priority_score`.

**Acceptance:** Format agreed and noted in `contracts.md` (Track D's file).

---

### Step C-2 — Seed data file `[Hours 1–6]` `[Must]`

Create `data/seed_data.json` with the following structure:

```json
{
  "incidents": [ ...15 incidents... ],
  "resources": [ ...15 resources... ],
  "hazard_zones": [ ...3 zones... ]
}
```

Requirements:
- 15 incidents: spread across severity 1–5 (at least 2 at severity 5, 3 at severity 4). Types: flood (6), fire (3), medical (4), structural (2). All lat/lng clustered in one metro area (pick one real city).
- 15 resources: 5 ambulances (skills: medical, extraction), 5 fire units (skills: fire, extraction), 5 police (skills: crowd_control, search). Distribute across the metro area so some are near incidents and some are far.
- 3 hazard zones: one flood polygon (low-lying area), one fire polygon (dry forest area), one structural zone (older building district). Each is a 4–6 point polygon.
- Each incident must include `density_index` (0–1) and `infra_weight` (0–1) fields for scoring.
- Each incident must include `required_skills` array.

**Acceptance:** Track A's seeder loads the file without errors. `GET /map-state` returns all 15 incidents, 15 resources, 3 hazard zones.

---

### Step C-3 — Flood scenario manifest `[Hours 6–10]` `[Must]`

Create `data/scenarios/flood.json` with 10 ticks:

- Ticks 1–3: add 2–3 new flood incidents near the flood hazard zone. Expand the flood polygon outward by ~0.005 degrees (approx 500m) uniformly.
- Ticks 4–6: add 1–2 medical incidents (people trapped in floodwater). Expand polygon further.
- Ticks 7–8: add a high-severity (5) structural incident — a bridge at risk. Hospital `infra_weight = 1.0`.
- Ticks 9–10: no new incidents. Hazard polygon stabilizes.

Make incidents progressively more severe across ticks (start with severity 2–3, escalate to 4–5 by tick 6).

**Acceptance:** `POST /scenarios/flood/start` replays all 10 ticks without errors. New incidents appear in `/map-state` sequentially.

---

### Step C-4 — Wildfire scenario manifest `[Hours 10–14]` `[Must]`

Create `data/scenarios/wildfire.json` with 10 ticks:

- Use a directional spread: expand the fire polygon asymmetrically — more to the northeast each tick (simulating wind direction).
- Add fire incidents near villages at the polygon's leading edge (ticks 1, 3, 5, 7).
- Add one medical incident (smoke inhalation) at tick 4.
- Escalate one existing fire incident from severity 3 to 5 at tick 6 (include it as a `new_incidents` entry with the same `id` — Track A should upsert on existing ID).
- Final two ticks: fire polygon recedes slightly (containment).

**Acceptance:** Wildfire polygon visibly spreads directionally across 10 ticks on the map.

---

### Step C-5 — Earthquake scenario manifest `[Hours 14–18]` `[Must]`

Create `data/scenarios/quake.json` with 8 ticks:

- Tick 1: add 6 structural incidents simultaneously (simulate the quake hit). All severity 4–5.
- Tick 2: add 4 medical incidents (injured civilians).
- Ticks 3–5: add road-blocked incidents (`type: "structural"`, `infra_weight: 0.5`) — these consume fire/extraction resources.
- Ticks 6–8: no new incidents; hazard zone (collapsed building district) remains static.

**Acceptance:** Earthquake scenario produces a burst of simultaneous incidents at tick 1 that stress-tests the allocator.

---

### Step C-6 — Spread model `[Hours 18–22]` `[Nice]`

Build `scripts/generate_spread.py` — a script that takes a starting polygon and generates N tick expansions. Use it to regenerate or adjust scenario polygons without hand-editing coordinates.

Logic:
- **Flood**: compute centroid, expand each vertex outward from centroid by a fixed distance each tick.
- **Wildfire**: expand vertices in a wind direction (configurable as a bearing angle). Vertices on the windward side expand more.
- **Earthquake**: static zone — no spread.

Run the script to validate your existing scenario manifests, then commit it to the repo for reference.

**Acceptance:** Script runs without errors and produces valid GeoJSON-like polygon arrays.

---

### Step C-7 — Manual vs AI comparison dataset `[Hours 22–24]` `[Nice]`

Create `data/comparison.json`:
- Pre-run the flood scenario twice on paper (or using a simple simulation script).
- **Manual assignment**: randomly assign the nearest resource regardless of skills.
- **AI assignment**: use the greedy allocator with scoring.
- Record: `manual_avg_eta_minutes`, `ai_avg_eta_minutes`, `manual_utilization`, `ai_utilization`.
- Example realistic values: manual = 18 min avg, AI = 9 min avg.

This file is used by Track D in the demo slides.

**Acceptance:** File committed with realistic values that demonstrate a clear improvement.

---

### Track C fallback if stuck

- Reduce each scenario to 5 ticks (not 10). Demo only runs 2 minutes — 5 ticks is enough.
- Skip the spread model script — hand-edit polygon coordinates directly in the manifest files.
- If wildfire directional spread is hard, use the same uniform expansion as the flood scenario.

---

## Track D — Integration, QA & Demo

**Owner:** Integration lead  
**Branch:** `track/integration`  
**Total estimated hours:** ~20 of 48

---

### Step D-1 — Write contracts.md `[Hours 0–2]` `[Must]`

Create `docs/contracts.md` containing:
- All four canonical JSON schemas (copy from this document).
- The full API contract table.
- The scoring formula.
- The scenario manifest format.
- Branch naming conventions and PR checklist.

Commit this before anyone else writes code. All tracks reference this file.

**Acceptance:** File committed to `main` by hour 2.

---

### Step D-2 — Unit tests for scoring and allocator `[Hours 2–8]` `[Must]`

Create `backend/tests/test_scoring.py` and `backend/tests/test_allocator.py`.

**Scoring tests (5 cases):**
1. All params at maximum → score = 100.
2. All params at zero → score = 0.
3. Only severity at max, rest zero → score = 35.
4. Changing weights changes output (set severity weight to 0, verify severity has no effect).
5. Score is always an integer (not a float).

**Allocator tests (3 cases):**
1. Two available resources, one closer — closer one is selected.
2. Closer resource has wrong skills — farther one with correct skills is selected.
3. No available resources — returns `{"status": "no_unit_available"}`.

Run with: `cd backend && pytest tests/ -v`

**Acceptance:** All 8 tests pass on Track A's branch by hour 12.

---

### Step D-3 — Smoke test round 1 `[Hours 12–16]` `[Must]`

Run the following 6-step smoke test against Track A's backend. File a Vibe Coding card for each step that fails, tagged to Track A.

```
1. Start backend: uvicorn main:app --reload
   Verify: GET /map-state returns 200 with incidents, resources, hazard_zones arrays

2. POST /incidents with body: {"type":"flood","severity":4,"lat":28.61,"lng":77.20,"location_desc":"Test"}
   Verify: Response includes priority_score (non-zero integer) and score_breakdown

3. POST /scenarios/flood/start
   Verify: Returns 200. Wait 10 seconds. GET /map-state shows more incidents than before.

4. POST /assign with body: {"incident_id": "<highest score incident ID>"}
   Verify: Response includes resource_id, eta_minutes (positive number), reason (non-empty string)

5. POST /assignments/<id>/override with body: {"resource_id": "<different available resource>"}
   Verify: Response has override_by_operator: true. Old resource returns to available in GET /map-state.

6. GET /kpis
   Verify: avg_response_time > 0, utilization_rate between 0 and 1, open_by_severity is non-empty dict
```

**Acceptance:** All 6 steps pass without 5xx errors.

---

### Step D-4 — End-to-end integration `[Hours 24–32]` `[Must]`

Connect Track B's frontend to Track A's backend. Run the full flood scenario end-to-end through the UI:

1. Open frontend in browser.
2. Click "Flood" scenario button in the sidebar.
3. Verify: new markers appear on map within 10 seconds.
4. Click a new incident → verify: right drawer opens with score breakdown.
5. Use the override dropdown → pick a different resource → click Reassign.
6. Verify: the incident's assigned resource changes in the drawer and on the map.
7. Watch KPI strip update.

File a card for each failure. If a frontend-backend integration bug cannot be fixed within 1 hour, revert the frontend to hard-coded seed data for the demo and mark it as a known issue.

**Acceptance:** Full scenario runs end-to-end through the UI without manual fixes.

**Sync point H32 deliverable:** E2E integration confirmed working or fallback mode decided.

---

### Step D-5 — Record fallback video `[Hours 32–36]` `[Must]`

Record a clean 3-minute screen capture of the working system. The video must show:

1. (0:00–0:30) Map with seed data loaded. Point out incident markers, hazard zones, resource icons.
2. (0:30–1:30) Start the flood scenario. Watch new incidents appear. Click the highest-priority incident. Show the score breakdown panel.
3. (1:30–2:15) Perform one operator override. Show the "Reason" text changing.
4. (2:15–3:00) Show the KPI strip updating. End on the comparison numbers: "Manual: 18 min avg → AI-coordinated: 9 min avg".

Save as `demo/fallback_demo.mp4`. Commit to repo.

**Acceptance:** Video plays cleanly, is at least 2:30 long, shows all four features.

---

### Step D-6 — Demo rehearsal `[Hours 36–44]` `[Must]`

Run the demo script three times with the full team. Time each run. Target: under 7 minutes total.

**Demo script:**

| Time | Speaker | Action |
|---|---|---|
| 0:00–0:45 | Track D | "Three agencies, one disaster, zero coordination. Here's the problem." Show the before-state on the map. |
| 0:45–2:30 | Track D (narrates), Track B (drives) | Start flood scenario. Point out auto-assignments. Open score breakdown. Say: "The system chose this unit because it's nearest with the right skills — score 84 out of 100." |
| 2:30–4:00 | Track D (narrates), Track B (drives) | Perform override. Say: "Operators stay in control. Every decision is logged and reversible." |
| 4:00–5:30 | Track D | Start wildfire scenario. Point out directional polygon spread and priority re-escalation. |
| 5:30–7:00 | Track D | Show KPI strip. "Average response time dropped from 18 minutes to 9 minutes. Resource utilization went from 40% to 82%." Show architecture slide. |

After each rehearsal run, note what broke or felt slow. Fix or cut those parts.

**Acceptance:** Demo runs in under 7 minutes without needing to explain errors.

---

### Step D-7 — Final buffer `[Hours 44–48]`

Fix any remaining bugs from rehearsal. Ensure backend starts cleanly from a fresh seed. Ensure the fallback video is accessible on a second device. Do a final check of the demo environment (WiFi, display output, browser zoom level).

---

### Track D fallback if stuck

- If E2E integration fails, run the demo entirely from the fallback video.
- If unit tests are failing due to Track A bugs, file the card and move on — don't block on fixing it yourself.
- If demo is too long, cut the wildfire scenario and go flood-only.

---

## Sync point checklist

### Hour 12 sync (15 minutes)

- [ ] Track A: `GET /map-state` is live and returning seed data
- [ ] Track B: map renders cleanly with seed data (local or live)
- [ ] Track C: `seed_data.json` committed with 15 incidents, 15 resources, 3 hazard zones
- [ ] Track D: all 8 unit tests pass on Track A's branch
- [ ] Blockers: any track that cannot hit their deliverable raises it now

### Hour 32 sync (15 minutes)

- [ ] Track A: all Must endpoints implemented and passing smoke tests
- [ ] Track B: live API polling works; override round-trips correctly through UI
- [ ] Track C: all three scenario manifests committed and tested
- [ ] Track D: E2E integration confirmed (or fallback mode agreed)
- [ ] Demo script finalized and speaking parts assigned

---

## PR checklist (every PR before merging to main)

- [ ] Matches canonical schema — no field renames
- [ ] New endpoint has a corresponding smoke test step noted in PR description
- [ ] No hardcoded `localhost` URLs — uses `API_BASE_URL` env var
- [ ] No `console.error` calls left in production paths
- [ ] Track D pinged as reviewer

---

## File structure reference

```
/
├── backend/
│   ├── main.py              # FastAPI app, route definitions
│   ├── state.py             # In-memory state store (INCIDENTS, RESOURCES, etc.)
│   ├── config.py            # WEIGHTS dict, constants
│   ├── scoring.py           # score_incident() function
│   ├── allocator.py         # allocate() greedy allocator
│   ├── scenario_runner.py   # start_scenario() background task
│   └── tests/
│       ├── test_scoring.py
│       └── test_allocator.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── MapView.jsx         # Leaflet map
│   │   │   ├── Sidebar.jsx         # Scenario buttons + incident list
│   │   │   ├── IncidentDrawer.jsx  # Right drawer with score breakdown
│   │   │   ├── KpiStrip.jsx        # KPI metrics
│   │   │   └── SosForm.jsx         # SOS modal form
│   │   └── hooks/
│   │       └── useMapState.js      # Polling hook
│   └── .env
├── data/
│   ├── seed_data.json
│   └── scenarios/
│       ├── flood.json
│       ├── wildfire.json
│       └── quake.json
├── docs/
│   └── contracts.md
├── demo/
│   └── fallback_demo.mp4
└── scripts/
    └── generate_spread.py
```

---

## Quick risk reference

| Risk | Immediate action |
|---|---|
| Backend API not ready when frontend needs it | Frontend loads `data/seed_data.json` directly — no backend needed until Step B-5 |
| Scenario runner crashes mid-demo | Serve scenario ticks as a static JSON array; frontend polls a file endpoint |
| `react-leaflet` lifecycle freeze | Replace with plain Leaflet in a `useRef` `useEffect` hook |
| Demo environment WiFi fails | Everything runs on localhost only; no external dependencies |
| Team member blocked at hour 24 | Track D drops QA tasks and picks up that track's next Must step |

---

*Generated for a 48-hour hackathon. For the 24-hour variant: run Track A + C as one person (flood scenario only, 5 ticks, no spread model) and Track B + D as one person (no KPI histogram, no responder view, fallback video at hour 20).*
