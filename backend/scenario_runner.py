import asyncio
import json
import os
import uuid
from datetime import datetime, timezone

import state
from scoring import score_incident
from config import SCENARIO_TICK_INTERVAL_SECONDS

# Track running scenarios to prevent duplicates
_running_scenarios = {}  # type: dict


async def start_scenario(name: str):
    """
    Load and replay a scenario manifest as a background task.
    Each tick adds new incidents and updates hazard zones.
    """
    if _running_scenarios.get(name):
        return  # Already running

    _running_scenarios[name] = True

    scenario_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "scenarios", f"{name}.json",
    )

    with open(scenario_path, "r") as f:
        scenario = json.load(f)

    ticks = scenario.get("ticks", [])

    for tick_data in ticks:
        if not _running_scenarios.get(name):
            break  # Scenario was stopped

        # Add new incidents
        for inc_data in tick_data.get("new_incidents", []):
            inc_id = f"inc_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()

            incident = {
                "id": inc_id,
                "type": inc_data.get("type", "other"),
                "severity": inc_data.get("severity", 1),
                "lat": inc_data["lat"],
                "lng": inc_data["lng"],
                "location_desc": inc_data.get("location_desc", ""),
                "reported_at": now,
                "status": "open",
                "priority_score": None,
                "assigned_resource_id": None,
                "density_index": inc_data.get("density_index", 0.5),
                "infra_weight": inc_data.get("infra_weight", 0.2),
                "required_skills": inc_data.get("required_skills", []),
                "score_breakdown": None,
            }

            # Score the incident
            score, breakdown = score_incident(incident, state.RESOURCES)
            incident["priority_score"] = score
            incident["score_breakdown"] = breakdown

            state.INCIDENTS[inc_id] = incident

            # Log event
            state.EVENT_LOG.append({
                "timestamp": now,
                "type": "incident_created",
                "payload": incident,
            })

        # Update hazard zones
        for hz_update in tick_data.get("hazard_updates", []):
            hz_id = hz_update.get("id")
            new_polygon = hz_update.get("polygon")
            if hz_id and new_polygon:
                for hz in state.HAZARD_ZONES:
                    if hz["id"] == hz_id:
                        hz["polygon"] = new_polygon
                        break

                state.EVENT_LOG.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": "hazard_updated",
                    "payload": {"id": hz_id, "polygon": new_polygon},
                })

        await asyncio.sleep(SCENARIO_TICK_INTERVAL_SECONDS)

    _running_scenarios[name] = False


def stop_scenario(name: str):
    """Stop a running scenario."""
    _running_scenarios[name] = False
