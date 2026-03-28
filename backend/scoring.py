import math
from typing import Optional, Tuple

from config import WEIGHTS


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in km between two lat/lng points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_incident(incident: dict, resources: dict, weights: Optional[dict] = None) -> Tuple[int, dict]:
    """
    Compute priority score for an incident.
    Returns (score_int, breakdown_dict).
    """
    w = weights or WEIGHTS

    # Severity normalized 0-1
    severity_norm = incident.get("severity", 0) / 5.0

    # Density index — comes directly from incident data
    density_index = incident.get("density_index", 0.0)

    # Proximity — distance to nearest available resource
    min_dist = None
    for res in resources.values():
        if res.get("status") == "available":
            d = haversine_km(
                incident["lat"], incident["lng"], res["lat"], res["lng"]
            )
            if min_dist is None or d < min_dist:
                min_dist = d

    if min_dist is not None:
        proximity_norm = max(0.0, 1.0 - (min_dist / 20.0))
    else:
        proximity_norm = 0.0

    # Infrastructure weight — comes directly from incident data
    infra_weight = incident.get("infra_weight", 0.0)

    raw = (
        severity_norm * w["severity"]
        + density_index * w["density"]
        + proximity_norm * w["proximity"]
        + infra_weight * w["infra"]
    )

    score = round(raw * 100)

    breakdown = {
        "severity": round(severity_norm * w["severity"] * 100),
        "population_density": round(density_index * w["density"] * 100),
        "proximity_to_resource": round(proximity_norm * w["proximity"] * 100),
        "infra_criticality": round(infra_weight * w["infra"] * 100),
    }

    return score, breakdown
