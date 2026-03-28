import uuid
from typing import Optional
from datetime import datetime, timezone

import state
from scoring import haversine_km


def allocate(incident_id: str, resources: Optional[dict] = None, force_resource_id: Optional[str] = None) -> dict:
    """
    Greedy allocator: assign the nearest available resource with matching skills.
    If force_resource_id is given, use that specific resource (for operator override).
    Returns an Assignment dict or a no-unit-available status dict.
    """
    incident = state.INCIDENTS.get(incident_id)
    if not incident:
        return {"status": "error", "message": f"Incident {incident_id} not found"}

    res_pool = resources if resources is not None else state.RESOURCES
    required_skills = set(incident.get("required_skills", []))

    if force_resource_id:
        # Operator override — use the specific resource
        resource = res_pool.get(force_resource_id)
        if not resource:
            return {"status": "error", "message": f"Resource {force_resource_id} not found"}
        best_resource = resource
        best_dist = haversine_km(
            incident["lat"], incident["lng"],
            resource["lat"], resource["lng"],
        )
    else:
        # Greedy: nearest available with matching skills
        best_resource = None
        best_dist = float("inf")

        for res in res_pool.values():
            if res.get("status") != "available":
                continue
            res_skills = set(res.get("skills", []))
            if not required_skills.intersection(res_skills):
                continue
            d = haversine_km(
                incident["lat"], incident["lng"],
                res["lat"], res["lng"],
            )
            if d < best_dist:
                best_dist = d
                best_resource = res

    if best_resource is None:
        return {"status": "no_unit_available", "incident_id": incident_id}

    # Compute ETA: assume 30 km/h average speed
    eta_minutes = round((best_dist / 30.0) * 60, 1)

    # Build assignment
    assignment_id = f"asgn_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    skill_match = list(required_skills.intersection(set(best_resource.get("skills", []))))

    assignment = {
        "id": assignment_id,
        "incident_id": incident_id,
        "resource_id": best_resource["id"],
        "created_at": now,
        "eta_minutes": eta_minutes,
        "status": "en_route",
        "override_by_operator": force_resource_id is not None,
        "reason": (
            f"{'Operator override' if force_resource_id else 'Nearest available unit'} "
            f"with {', '.join(skill_match)} skill(s); "
            f"distance {best_dist:.1f}km; "
            f"score {incident.get('priority_score', 'N/A')}"
        ),
    }

    # Update state
    best_resource["status"] = "busy"
    best_resource["eta_minutes"] = eta_minutes
    incident["assigned_resource_id"] = best_resource["id"]
    incident["status"] = "assigned"

    state.ASSIGNMENTS[assignment_id] = assignment

    return assignment
