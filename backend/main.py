import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import state
from config import WEIGHTS
from scoring import score_incident
from allocator import allocate
from scenario_runner import start_scenario

app = FastAPI(title="Disaster Response Coordination System", version="1.0.0")

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data loader
# ---------------------------------------------------------------------------

def load_seed_data():
    """Load seed data from data/seed_data.json on startup."""
    seed_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "seed_data.json",
    )
    if not os.path.exists(seed_path):
        print(f"WARNING: Seed file not found at {seed_path}")
        return

    with open(seed_path, "r") as f:
        data = json.load(f)

    # Load incidents
    for inc in data.get("incidents", []):
        inc_id = inc["id"]
        # Score each incident
        score, breakdown = score_incident(inc, {})  # No resources loaded yet
        inc["priority_score"] = score
        inc["score_breakdown"] = breakdown
        state.INCIDENTS[inc_id] = inc

    # Load resources
    for res in data.get("resources", []):
        state.RESOURCES[res["id"]] = res

    # Re-score incidents now that resources are loaded
    for inc_id, inc in state.INCIDENTS.items():
        score, breakdown = score_incident(inc, state.RESOURCES)
        inc["priority_score"] = score
        inc["score_breakdown"] = breakdown

    # Load hazard zones
    state.HAZARD_ZONES = data.get("hazard_zones", [])

    print(
        f"Loaded {len(state.INCIDENTS)} incidents, "
        f"{len(state.RESOURCES)} resources, "
        f"{len(state.HAZARD_ZONES)} hazard zones"
    )


@app.on_event("startup")
async def startup_event():
    load_seed_data()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    type: str
    severity: int = Field(ge=1, le=5)
    lat: float
    lng: float
    location_desc: str = ""
    density_index: float = Field(default=0.5, ge=0.0, le=1.0)
    infra_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    required_skills: List[str] = Field(default_factory=lambda: ["extraction"])


class AssignRequest(BaseModel):
    incident_id: str


class OverrideRequest(BaseModel):
    resource_id: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/map-state")
def get_map_state():
    """Return all incidents, resources, and hazard zones."""
    return {
        "incidents": list(state.INCIDENTS.values()),
        "resources": list(state.RESOURCES.values()),
        "hazard_zones": state.HAZARD_ZONES,
    }


@app.post("/incidents")
def create_incident(body: IncidentCreate):
    """Create a new incident, score it, and return it."""
    inc_id = f"inc_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    incident = {
        "id": inc_id,
        "type": body.type,
        "severity": body.severity,
        "lat": body.lat,
        "lng": body.lng,
        "location_desc": body.location_desc,
        "reported_at": now,
        "status": "open",
        "priority_score": None,
        "assigned_resource_id": None,
        "density_index": body.density_index,
        "infra_weight": body.infra_weight,
        "required_skills": body.required_skills,
        "score_breakdown": None,
    }

    score, breakdown = score_incident(incident, state.RESOURCES)
    incident["priority_score"] = score
    incident["score_breakdown"] = breakdown

    state.INCIDENTS[inc_id] = incident

    state.EVENT_LOG.append({
        "timestamp": now,
        "type": "incident_created",
        "payload": incident,
    })

    return incident


@app.post("/assign")
def assign_resource(body: AssignRequest):
    """Run the greedy allocator for the given incident."""
    result = allocate(body.incident_id)

    if result.get("status") in ("error", "no_unit_available"):
        raise HTTPException(
            status_code=400 if result["status"] == "error" else 404,
            detail=result,
        )

    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "assignment_created",
        "payload": result,
    })

    return result


@app.get("/assignments")
def list_assignments():
    """Return all assignments."""
    return list(state.ASSIGNMENTS.values())


@app.post("/assignments/{assignment_id}/override")
def override_assignment(assignment_id: str, body: OverrideRequest):
    """Reassign an incident to a different resource (operator override)."""
    assignment = state.ASSIGNMENTS.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Assignment {assignment_id} not found")

    # Release old resource
    old_resource_id = assignment["resource_id"]
    old_resource = state.RESOURCES.get(old_resource_id)
    if old_resource:
        old_resource["status"] = "available"
        old_resource["eta_minutes"] = None

    # Reset incident status to allow re-allocation
    incident_id = assignment["incident_id"]
    incident = state.INCIDENTS.get(incident_id)
    if incident:
        incident["status"] = "open"
        incident["assigned_resource_id"] = None

    # Remove old assignment
    del state.ASSIGNMENTS[assignment_id]

    # Allocate with forced resource
    result = allocate(incident_id, force_resource_id=body.resource_id)

    if result.get("status") in ("error", "no_unit_available"):
        raise HTTPException(status_code=400, detail=result)

    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "override",
        "payload": result,
    })

    return result


VALID_SCENARIOS = {"flood", "wildfire", "quake"}


@app.post("/scenarios/{name}/start")
async def start_scenario_endpoint(name: str, background_tasks: BackgroundTasks):
    """Start a scenario replay."""
    if name not in VALID_SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Invalid scenario: {name}. Must be one of {VALID_SCENARIOS}")

    background_tasks.add_task(start_scenario, name)

    return {"status": "started", "scenario": name}


@app.get("/kpis")
def get_kpis():
    """Return KPI metrics."""
    assignments = list(state.ASSIGNMENTS.values())

    # Average response time
    etas = [a["eta_minutes"] for a in assignments if a.get("eta_minutes") is not None]
    avg_response_time = round(sum(etas) / len(etas), 1) if etas else 0.0

    # Utilization rate
    total = len(state.RESOURCES)
    busy = sum(1 for r in state.RESOURCES.values() if r.get("status") == "busy")
    utilization_rate = round(busy / total, 2) if total > 0 else 0.0

    # Open incidents by severity
    open_by_severity = {}
    for inc in state.INCIDENTS.values():
        if inc.get("status") == "open":
            sev = str(inc.get("severity", 0))
            open_by_severity[sev] = open_by_severity.get(sev, 0) + 1

    return {
        "avg_response_time": avg_response_time,
        "utilization_rate": utilization_rate,
        "open_by_severity": open_by_severity,
    }


@app.get("/events")
def get_events(since: str = Query(default="1970-01-01T00:00:00Z")):
    """Return events since the given ISO timestamp (polling fallback)."""
    return [e for e in state.EVENT_LOG if e["timestamp"] > since]
