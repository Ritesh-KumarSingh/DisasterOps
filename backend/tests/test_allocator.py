import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import state
from allocator import allocate


def _reset_state():
    state.INCIDENTS.clear()
    state.RESOURCES.clear()
    state.ASSIGNMENTS.clear()
    state.HAZARD_ZONES.clear()
    state.EVENT_LOG.clear()


def _make_incident(inc_id="inc_t1", lat=28.6139, lng=77.2090, required_skills=None):
    return {
        "id": inc_id,
        "type": "flood",
        "severity": 4,
        "lat": lat,
        "lng": lng,
        "location_desc": "Test location",
        "reported_at": "2024-01-15T09:14:00Z",
        "status": "open",
        "priority_score": 80,
        "assigned_resource_id": None,
        "density_index": 0.8,
        "infra_weight": 0.5,
        "required_skills": required_skills or ["medical", "extraction"],
        "score_breakdown": {},
    }


def _make_resource(res_id, lat, lng, skills, status="available"):
    return {
        "id": res_id,
        "agency": "ambulance",
        "unit_name": f"Unit {res_id}",
        "capacity": 2,
        "current_load": 0,
        "status": status,
        "lat": lat,
        "lng": lng,
        "eta_minutes": None,
        "skills": skills,
    }


class TestAllocator:
    """Test suite for the greedy allocator."""

    def test_picks_closest_resource(self):
        """Two available resources, one closer — closer one is selected."""
        _reset_state()

        inc = _make_incident()
        state.INCIDENTS[inc["id"]] = inc

        # Close resource (same lat/lng)
        close = _make_resource("res_close", 28.6140, 77.2091, ["medical", "extraction"])
        # Far resource
        far = _make_resource("res_far", 28.7000, 77.3000, ["medical", "extraction"])
        state.RESOURCES["res_close"] = close
        state.RESOURCES["res_far"] = far

        result = allocate(inc["id"])
        assert result["resource_id"] == "res_close", (
            f"Expected res_close but got {result['resource_id']}"
        )

    def test_skips_wrong_skills(self):
        """Closer resource has wrong skills — farther one with correct skills is selected."""
        _reset_state()

        inc = _make_incident(required_skills=["medical"])
        state.INCIDENTS[inc["id"]] = inc

        # Close resource with wrong skills
        close = _make_resource("res_close", 28.6140, 77.2091, ["fire"])
        # Far resource with correct skills
        far = _make_resource("res_far", 28.6500, 77.2500, ["medical", "extraction"])
        state.RESOURCES["res_close"] = close
        state.RESOURCES["res_far"] = far

        result = allocate(inc["id"])
        assert result["resource_id"] == "res_far", (
            f"Expected res_far but got {result['resource_id']}"
        )

    def test_no_available_resources(self):
        """No available resources → returns no_unit_available status."""
        _reset_state()

        inc = _make_incident()
        state.INCIDENTS[inc["id"]] = inc

        # One resource but it's busy
        busy = _make_resource("res_busy", 28.6140, 77.2091, ["medical"], status="busy")
        state.RESOURCES["res_busy"] = busy

        result = allocate(inc["id"])
        assert result["status"] == "no_unit_available", (
            f"Expected no_unit_available but got {result}"
        )
