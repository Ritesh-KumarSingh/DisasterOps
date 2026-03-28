import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scoring import score_incident


def _make_incident(**overrides):
    base = {
        "id": "test_inc",
        "type": "flood",
        "severity": 3,
        "lat": 28.6139,
        "lng": 77.2090,
        "density_index": 0.5,
        "infra_weight": 0.5,
        "required_skills": ["extraction"],
    }
    base.update(overrides)
    return base


def _make_resource(lat=28.6139, lng=77.2090, status="available", res_id="res_1"):
    return {
        "id": res_id,
        "agency": "ambulance",
        "unit_name": "Test Unit",
        "capacity": 2,
        "current_load": 0,
        "status": status,
        "lat": lat,
        "lng": lng,
        "eta_minutes": None,
        "skills": ["medical", "extraction"],
    }


class TestScoring:
    """Test suite for the priority scoring function."""

    def test_all_max_scores_100(self):
        """All parameters at maximum → score = 100."""
        inc = _make_incident(severity=5, density_index=1.0, infra_weight=1.0)
        # Place resource at exact same location → proximity = 1.0
        resources = {"r1": _make_resource(lat=inc["lat"], lng=inc["lng"])}
        weights = {"severity": 0.35, "density": 0.25, "proximity": 0.25, "infra": 0.15}
        score, breakdown = score_incident(inc, resources, weights)
        assert score == 100, f"Expected 100 but got {score}"

    def test_all_zero_scores_0(self):
        """All parameters at zero → score = 0."""
        inc = _make_incident(severity=0, density_index=0.0, infra_weight=0.0)
        # No available resources → proximity = 0
        resources = {}
        weights = {"severity": 0.35, "density": 0.25, "proximity": 0.25, "infra": 0.15}
        score, breakdown = score_incident(inc, resources, weights)
        assert score == 0, f"Expected 0 but got {score}"

    def test_only_severity_max(self):
        """Only severity at max, rest zero → score = 35."""
        inc = _make_incident(severity=5, density_index=0.0, infra_weight=0.0)
        resources = {}  # No resources → proximity = 0
        weights = {"severity": 0.35, "density": 0.25, "proximity": 0.25, "infra": 0.15}
        score, breakdown = score_incident(inc, resources, weights)
        assert score == 35, f"Expected 35 but got {score}"

    def test_changing_weights_changes_output(self):
        """Setting severity weight to 0 makes severity have no effect."""
        inc = _make_incident(severity=5, density_index=0.0, infra_weight=0.0)
        resources = {}
        # Zero out severity weight
        weights = {"severity": 0.0, "density": 0.25, "proximity": 0.25, "infra": 0.15}
        score, breakdown = score_incident(inc, resources, weights)
        assert score == 0, f"Expected 0 with zero severity weight but got {score}"

    def test_score_is_always_integer(self):
        """Score is always an integer."""
        inc = _make_incident(severity=3, density_index=0.7, infra_weight=0.4)
        resources = {"r1": _make_resource(lat=28.62, lng=77.21)}
        score, breakdown = score_incident(inc, resources)
        assert isinstance(score, int), f"Expected int but got {type(score)}"
