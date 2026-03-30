import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai

import state
import database as db
from config import WEIGHTS
from scoring import score_incident
from allocator import allocate
from agents import MultiAgentSystem

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

multi_agent = MultiAgentSystem()

app = FastAPI(title="Disaster Response Coordination System", version="1.1.0")

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data loader - NOW PERSISTENT & FILTERED
# ---------------------------------------------------------------------------

def load_seed_data():
    """Load emergency resources from data/seed_data.json on startup if DB is empty."""
    db.init_db()
    
    existing_resources = db.get_all_resources()
    if existing_resources:
        print(f"Skipping seed data: {len(existing_resources)} resources already in DB.")
        return

    seed_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "seed_data.json",
    )
    if not os.path.exists(seed_path):
        print(f"WARNING: Seed file not found at {seed_path}")
        return

    with open(seed_path, "r") as f:
        data = json.load(f)

    # ONLY Load resources (Emergency Units)
    for res in data.get("resources", []):
        db.save_resource(res)

    print(f"Loaded {len(data.get('resources', []))} resources into persistent storage.")


@app.on_event("startup")
async def startup_event():
    load_seed_data()
    asyncio.create_task(auto_allocator_loop())


async def auto_allocator_loop():
    """Background task to continuously attempt allocation for open incidents."""
    while True:
        await asyncio.sleep(5)
        if getattr(state, "AUTO_DISPATCH", False) is False:
            continue
            
        try:
            incidents = db.get_all_incidents()
            # Only process open incidents
            open_incidents = [i for i in incidents if i.get("status") == "open"]
            if not open_incidents:
                continue
                
            # Sort strictly by priority_score descending
            open_incidents.sort(key=lambda x: (x.get("priority_score") or 0), reverse=True)
            
            resources = db.get_all_resources()
            state.INCIDENTS = {i["id"]: i for i in incidents}
            state.RESOURCES = {r["id"]: r for r in resources}
            state.ASSIGNMENTS = {a["id"]: a for a in db.get_all_assignments()}

            updates_made = False

            for inc in open_incidents:
                result = allocate(inc["id"])
                if result.get("status") not in ("error", "no_unit_available"):
                    assignment = result
                    db.save_assignment(assignment)
                    db.save_incident(state.INCIDENTS[inc["id"]])
                    db.save_resource(state.RESOURCES[assignment["resource_id"]])
                    state.EVENT_LOG.append({
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "type": "assignment_auto_created",
                        "payload": result,
                    })
                    updates_made = True
            
            if updates_made:
                print("Auto-dispatch loop allocated responders successfully.")
            
            # --- Multi-Agent Strategic Analysis ---
            # Every 3 loops (~15 seconds), run the strategist
            if not hasattr(state, "_last_agent_run"):
                state._last_agent_run = 0
            
            state._last_agent_run += 1
            if state._last_agent_run >= 3:
                state._last_agent_run = 0
                print("Starting Auto Multi-Agent Analysis...")
                strategy = await multi_agent.run_coordination_cycle(
                    open_incidents, resources, db.get_all_disaster_events()
                )
                state.STRATEGIC_INSIGHTS = strategy
                # Also save predicted zones as hazard zones
                state.HAZARD_ZONES = strategy.get("predicted_impact_zones", [])
                print("Multi-Agent Analysis complete.")
                
        except Exception as e:
            print(f"Auto-allocator error: {e}")


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


class UserRegister(BaseModel):
    username: str
    role: str = Field(pattern="^(citizen|responder|operator)$")


class UserLogin(BaseModel):
    username: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------



class TriageRequest(BaseModel):
    text: str


@app.post("/nlp-triage")
def nlp_triage(body: TriageRequest):
    """Use Gemini to parse a citizen's emergency description into structured triage data."""
    prompt = f"""You are a 911 emergency dispatcher AI. A citizen has reported an emergency with the following description:

\"{body.text}\"

Analyze this message and return a JSON object with exactly these fields:
- "type": one of ["flood", "fire", "medical", "structural", "crime"]
- "severity": integer from 1 (minor) to 5 (catastrophic), based on threat to life and property
- "required_skills": array of skills needed from ["medical", "extraction", "fire", "search", "crowd_control"]
- "summary": a short 1-sentence summary of the emergency

Respond ONLY with valid JSON, no markdown, no explanation."""

    try:
        from dotenv import load_dotenv as _ld
        _ld(override=True)
        genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        result = json.loads(raw)

        # Validate and clamp values
        valid_types = ["flood", "fire", "medical", "structural", "crime"]
        valid_skills = ["medical", "extraction", "fire", "search", "crowd_control"]
        result["type"] = result.get("type", "medical") if result.get("type") in valid_types else "medical"
        result["severity"] = max(1, min(5, int(result.get("severity", 3))))
        result["required_skills"] = [s for s in result.get("required_skills", ["extraction"]) if s in valid_skills] or ["extraction"]
        result["summary"] = result.get("summary", body.text[:80])
        result["source"] = "gemini"
        return result
    except Exception as e:
        print(f"Gemini NLP triage error: {e}")
        # Fallback to basic keyword matching
        lower = body.text.lower()
        fallback_type = "medical"
        for t, keywords in {"flood": ["flood", "water", "rain"], "fire": ["fire", "smoke", "flame", "burning"], "structural": ["collapse", "building", "earthquake"], "crime": ["crime", "robbery", "attack", "police"]}.items():
            if any(k in lower for k in keywords):
                fallback_type = t
                break
        return {"type": fallback_type, "severity": 3, "required_skills": ["extraction"], "summary": body.text[:80], "source": "fallback"}


@app.get("/map-state")
def get_map_state():
    """Return all incidents, resources, hazard zones, and active disaster events."""
    events = db.get_all_disaster_events()
    active_events = [e for e in events if e["status"] == "active"]
    # attach zones to active events for map display
    event_zones = db.get_all_event_zones()
    for e in active_events:
        e["zones"] = [z for z in event_zones if z["event_id"] == e["id"]]

    return {
        "incidents": db.get_all_incidents(),
        "resources": db.get_all_resources(),
        "assignments": db.get_all_assignments(),
        "hazard_zones": state.HAZARD_ZONES, # Still in memory (dynamic)
        "active_events": active_events
    }


@app.post("/register")
def register_user(body: UserRegister):
    res = db.create_user(body.username, "", body.role)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@app.post("/login")
def login_user(body: UserLogin):
    res = db.verify_user(body.username, "")
    if res["status"] == "error":
        raise HTTPException(status_code=401, detail=res["message"])
    return res


@app.post("/toggle-auto-dispatch")
def toggle_auto_dispatch(enabled: bool = Query(...)):
    """Toggle the background automated intelligence dispatch loop."""
    state.AUTO_DISPATCH = enabled
    return {"status": "success", "auto_dispatch": state.AUTO_DISPATCH}


@app.post("/incidents")
def create_incident_endpoint(body: IncidentCreate):
    """Create a new incident, score it, and return it."""
    inc_id = f"inc_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    req_skills = body.required_skills
    if req_skills == ["extraction"]:
        skill_map = {
            "flood": ["extraction"],
            "fire": ["fire"],
            "medical": ["medical"],
            "structural": ["search"],
            "crime": ["crowd_control"],
        }
        req_skills = skill_map.get(body.type, ["extraction"])

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
        "required_skills": req_skills,
        "score_breakdown": None,
    }

    resources = {r["id"]: r for r in db.get_all_resources()}
    score, breakdown = score_incident(incident, resources)
    incident["priority_score"] = score
    incident["score_breakdown"] = breakdown

    db.save_incident(incident)

    state.EVENT_LOG.append({
        "timestamp": now,
        "type": "incident_created",
        "payload": incident,
    })

    return incident


@app.get("/multi-agent/strategy")
def get_strategic_insights():
    return getattr(state, "STRATEGIC_INSIGHTS", {
        "status": "pending",
        "predicted_impact_zones": [],
        "strategic_recommendation": {"priority_actions": [], "risk_summary": "Loading..."}
    })


@app.post("/multi-agent/trigger")
async def trigger_agent_analysis():
    """Manually trigger the multi-agent system."""
    incidents = db.get_all_incidents()
    open_incidents = [i for i in incidents if i.get("status") == "open"]
    resources = db.get_all_resources()
    active_events = db.get_all_disaster_events()
    
    strategy = await multi_agent.run_coordination_cycle(
        open_incidents, resources, active_events
    )
    state.STRATEGIC_INSIGHTS = strategy
    state.HAZARD_ZONES = strategy.get("predicted_impact_zones", [])
    return strategy


@app.post("/assign")
def assign_resource(body: AssignRequest):
    """Run the greedy allocator for the given incident."""
    # Sync DB state to allocator's expected format (memory dicts)
    # Note: In a larger app, allocator would be modified to use DB directly.
    # For this transition, we'll sync and then save.
    
    incidents = db.get_all_incidents()
    resources = db.get_all_resources()
    
    # Temporarily populate state to support allocator.py as-is
    state.INCIDENTS = {i["id"]: i for i in incidents}
    state.RESOURCES = {r["id"]: r for r in resources}
    state.ASSIGNMENTS = {a["id"]: a for a in db.get_all_assignments()}

    result = allocate(body.incident_id)

    if result.get("status") in ("error", "no_unit_available"):
        raise HTTPException(
            status_code=400 if result["status"] == "error" else 404,
            detail=result,
        )

    # Save changes back to DB
    assignment = result
    db.save_assignment(assignment)
    
    incident = state.INCIDENTS[body.incident_id]
    db.save_incident(incident)
    
    resource = state.RESOURCES[assignment["resource_id"]]
    db.save_resource(resource)

    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "assignment_created",
        "payload": result,
    })

    return result


@app.get("/assignments")
def list_assignments():
    """Return all assignments."""
    return db.get_all_assignments()


@app.post("/assignments/{assignment_id}/override")
def override_assignment(assignment_id: str, body: OverrideRequest):
    """Reassign an incident to a different resource (operator override)."""
    # Load from DB to memory
    incidents = db.get_all_incidents()
    resources = db.get_all_resources()
    assignments = db.get_all_assignments()
    
    state.INCIDENTS = {i["id"]: i for i in incidents}
    state.RESOURCES = {r["id"]: r for r in resources}
    state.ASSIGNMENTS = {a["id"]: a for a in assignments}

    assignment = state.ASSIGNMENTS.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Assignment {assignment_id} not found")

    # Release old resource
    old_resource_id = assignment["resource_id"]
    old_resource = state.RESOURCES.get(old_resource_id)
    if old_resource:
        old_resource["status"] = "available"
        old_resource["eta_minutes"] = None
        db.save_resource(old_resource)

    # Reset incident status to allow re-allocation
    incident_id = assignment["incident_id"]
    incident = state.INCIDENTS.get(incident_id)
    if incident:
        incident["status"] = "open"
        incident["assigned_resource_id"] = None
        db.save_incident(incident)

    # Remove old assignment
    db.delete_assignment(assignment_id)
    del state.ASSIGNMENTS[assignment_id]

    # Allocate with forced resource
    result = allocate(incident_id, force_resource_id=body.resource_id)

    if result.get("status") in ("error", "no_unit_available"):
        raise HTTPException(status_code=400, detail=result)

    # Save new assignment and updated resource/incident
    db.save_assignment(result)
    db.save_incident(state.INCIDENTS[incident_id])
    db.save_resource(state.RESOURCES[body.resource_id])

    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "override",
        "payload": result,
    })

    return result


@app.post("/assignments/{assignment_id}/status")
def update_assignment_status(assignment_id: str, status: str = Query(...)):
    """Update assignment status (e.g., 'arrived')."""
    assignments = {a["id"]: a for a in db.get_all_assignments()}
    assignment = assignments.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment["status"] = status
    db.save_assignment(assignment)
    
    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "assignment_status_update",
        "payload": assignment,
    })
    return {"status": "success", "assignment": assignment}


@app.post("/assignments/{assignment_id}/resolve")
def resolve_assignment(assignment_id: str):
    """Complete a mission: mark everything as resolved and free the unit."""
    assignments = {a["id"]: a for a in db.get_all_assignments()}
    assignment = assignments.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # 1. Update assignment to resolved
    assignment["status"] = "resolved"
    db.save_assignment(assignment)

    # 2. Update incident and clear backup flag
    incident_id = assignment["incident_id"]
    incidents = {i["id"]: i for i in db.get_all_incidents()}
    inc = incidents.get(incident_id)
    if inc:
        inc["status"] = "resolved"
        inc["backup_requested"] = False
        db.save_incident(inc)

    # 3. Release ALL resources assigned to this incident
    all_assignments = db.get_all_assignments()
    relevant_asgns = [a for a in all_assignments if a["incident_id"] == incident_id]
    resources = {r["id"]: r for r in db.get_all_resources()}
    
    for a in relevant_asgns:
        # Mark assignment as resolved in DB
        a["status"] = "resolved"
        db.save_assignment(a)
        
        # Free the resource
        res = resources.get(a["resource_id"])
        if res:
            res["status"] = "available"
            res["eta_minutes"] = None
            db.save_resource(res)

    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "mission_resolved",
        "payload": {"incident_id": incident_id},
    })
    return {"status": "success", "message": "Mission resolved and unit standby."}


@app.post("/incidents/{incident_id}/backup")
def request_incident_backup(incident_id: str):
    """Flag backup needed and AUTO-DISPATCH the nearest secondary unit of the same agency."""
    incidents = {i["id"]: i for i in db.get_all_incidents()}
    inc = incidents.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # 1. Mark incident as needing backup
    inc["backup_requested"] = True
    db.save_incident(inc)

    # 2. Find the agency of the currently assigned unit
    current_assignments = [a for a in db.get_all_assignments() if a["incident_id"] == incident_id]
    if not current_assignments:
        # If somehow not assigned, just log and return
        state.EVENT_LOG.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "backup_requested",
            "payload": inc,
        })
        return {"status": "success", "message": "Backup flagged (no primary unit found)."}

    primary_res_id = current_assignments[0]["resource_id"]
    resources = {r["id"]: r for r in db.get_all_resources()}
    primary_res = resources.get(primary_res_id)
    
    backup_unit = None
    if primary_res:
        agency = primary_res["agency"]
        
        # 3. Find nearest AVAILABLE unit of the SAME agency
        available_same_agency = [
            r for r in resources.values() 
            if r["status"] == "available" and r["agency"] == agency and r["id"] != primary_res_id
        ]
        
        if available_same_agency:
            # Sort by distance
            def dist(r):
                return ((r["lat"] - inc["lat"])**2 + (r["lng"] - inc["lng"])**2)**0.5
            
            backup_unit = min(available_same_agency, key=dist)
    
    # 4. Create secondary assignment if backup unit found
    backup_status = "no_unit_available"
    if backup_unit:
        new_assignment = {
            "id": f"asgn_{uuid.uuid4().hex[:8]}",
            "incident_id": incident_id,
            "resource_id": backup_unit["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "eta_minutes": 5, # Mock ETA
            "status": "en_route",
            "override_by_operator": False,
            "reason": "AUTO_BACKUP_DISPATCH"
        }
        db.save_assignment(new_assignment)
        
        backup_unit["status"] = "busy"
        db.save_resource(backup_unit)
        backup_status = f"dispatched_{backup_unit['unit_name']}"

    # Log critical event
    state.EVENT_LOG.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "backup_requested",
        "payload": {
            "incident_id": incident_id,
            "backup_status": backup_status,
            "incident_summary": inc.get("summary", inc.get("location_desc", ""))
        },
    })
    
    return {
        "status": "success", 
        "backup_requested": True, 
        "dispatch_status": backup_status
    }
    return {"status": "success", "message": "Backup request logged."}


@app.get("/kpis")
def get_kpis():
    """Return KPI metrics."""
    assignments = db.get_all_assignments()
    resources = db.get_all_resources()
    incidents = db.get_all_incidents()

    # Average response time
    etas = [a["eta_minutes"] for a in assignments if a.get("eta_minutes") is not None]
    avg_response_time = round(sum(etas) / len(etas), 1) if etas else 0.0

    # Utilization rate
    total = len(resources)
    busy = sum(1 for r in resources if r.get("status") == "busy")
    utilization_rate = round(busy / total, 2) if total > 0 else 0.0

    # Open incidents by severity
    open_by_severity = {}
    for inc in incidents:
        if inc.get("status") == "open":
            sev = str(inc.get("severity", 0))
            open_by_severity[sev] = open_by_severity.get(sev, 0) + 1

    return {
        "avg_response_time": avg_response_time,
        "utilization_rate": utilization_rate,
        "open_by_severity": open_by_severity,
    }


# ---------------------------------------------------------------------------
# Disaster Event Management Endpoints
# ---------------------------------------------------------------------------

class DisasterEventCreate(BaseModel):
    type: str
    location_name: str
    lat: float
    lng: float
    severity: int = Field(ge=1, le=5)
    created_by: str = ""
    metadata: dict = {}

class EventZoneCreate(BaseModel):
    name: str = ""
    type: str = Field(pattern="^(safe|unsafe|evacuation)$")
    lat: float
    lng: float
    radius_km: float

class EventTaskCreate(BaseModel):
    title: str
    assigned_to: Optional[str] = None
    status: str = "open"

class EventTaskUpdate(BaseModel):
    assigned_to: Optional[str] = None
    status: Optional[str] = None

class DisasterEventUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[int] = None

@app.post("/disaster-events")
def create_disaster_event(body: DisasterEventCreate):
    ev_id = f"evt_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    ev = {
        "id": ev_id,
        "type": body.type,
        "location_name": body.location_name,
        "lat": body.lat,
        "lng": body.lng,
        "severity": body.severity,
        "status": "active",
        "created_by": body.created_by,
        "created_at": now,
        "resolved_at": None,
        "metadata": body.metadata
    }
    db.save_disaster_event(ev)
    return ev


@app.get("/disaster-events")
def list_disaster_events():
    return db.get_all_disaster_events()


@app.get("/disaster-events/{event_id}")
def get_disaster_event_details(event_id: str):
    ev = db.get_disaster_event(event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev["zones"] = db.get_zones_for_event(event_id)
    ev["tasks"] = db.get_tasks_for_event(event_id)
    return ev


@app.patch("/disaster-events/{event_id}")
def update_disaster_event(event_id: str, body: DisasterEventUpdate):
    ev = db.get_disaster_event(event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if body.status:
        ev["status"] = body.status
        if body.status == "resolved" and not ev["resolved_at"]:
            ev["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if body.severity:
        ev["severity"] = body.severity
        
    db.save_disaster_event(ev)
    return ev


@app.post("/disaster-events/{event_id}/zones")
def add_event_zone(event_id: str, body: EventZoneCreate):
    ev = db.get_disaster_event(event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    zone_id = f"zn_{uuid.uuid4().hex[:6]}"
    zone = {
        "id": zone_id,
        "event_id": event_id,
        "name": body.name,
        "type": body.type,
        "lat": body.lat,
        "lng": body.lng,
        "radius_km": body.radius_km
    }
    db.save_event_zone(zone)
    return zone


@app.delete("/disaster-events/{event_id}/zones/{zone_id}")
def delete_event_zone_endpoint(event_id: str, zone_id: str):
    # Quick check if it exists
    zones = db.get_zones_for_event(event_id)
    if not any(z["id"] == zone_id for z in zones):
         raise HTTPException(status_code=404, detail="Zone not found")
    db.delete_event_zone(zone_id)
    return {"status": "deleted"}


@app.post("/disaster-events/{event_id}/tasks")
def add_event_task(event_id: str, body: EventTaskCreate):
    ev = db.get_disaster_event(event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    task_id = f"tsk_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "id": task_id,
        "event_id": event_id,
        "title": body.title,
        "assigned_to": body.assigned_to,
        "status": body.status,
        "created_at": now
    }
    db.save_event_task(task)
    return task


@app.patch("/disaster-events/{event_id}/tasks/{task_id}")
def update_event_task(event_id: str, task_id: str, body: EventTaskUpdate):
    tasks = db.get_tasks_for_event(event_id)
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if body.assigned_to is not None:  # explicit empty string can unassign
        if body.assigned_to == "":
            task["assigned_to"] = None
        else:
            task["assigned_to"] = body.assigned_to
            task["status"] = "in_progress" if task["status"] == "open" else task["status"]
            
    if body.status is not None:
        task["status"] = body.status
        
    db.save_event_task(task)
    return task


# ---------------------------------------------------------------------------
# Root / health-check — the frontend is now a separate Vite dev server
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok", "app": "DisasterOps API", "version": "1.1.0"}

