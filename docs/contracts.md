# Disaster Response Coordination System — Contracts

## Canonical JSON Schemas

### Incident
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

### Resource
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

### Assignment
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

### Hazard Zone
```json
{
  "id": "hz_001",
  "type": "flood",
  "risk_level": 0.8,
  "polygon": [[28.61, 77.20], [28.62, 77.21], [28.60, 77.22]]
}
```

### Scenario Tick
```json
{
  "tick": 3,
  "new_incidents": [{ "...incident fields..." }],
  "hazard_updates": [{ "id": "hz_001", "polygon": [[28.61, 77.20]] }]
}
```

---

## API Contract

| Endpoint | Method | Priority | Request body / notes |
|---|---|---|---|
| `/map-state` | GET | Must | Returns `{incidents[], resources[], hazard_zones[]}` |
| `/incidents` | POST | Must | Body: `{type, severity, lat, lng, location_desc}` → returns new incident with computed score |
| `/assign` | POST | Must | Body: `{incident_id}` → runs allocator, returns assignment |
| `/assignments/{id}/override` | POST | Must | Body: `{resource_id}` → reassigns, sets `override_by_operator: true` |
| `/scenarios/{name}/start` | POST | Must | `name` is `flood`, `wildfire`, or `quake` → starts tick replay |
| `/kpis` | GET | Must | Returns `{avg_response_time, utilization_rate, open_by_severity{}}` |
| `/events?since={timestamp}` | GET | Nice | Returns events since timestamp — polling fallback |
| `/assignments` | GET | Must | Returns all assignments as a list |

---

## Priority Scoring Formula

```
score = (severity_norm × 0.35 + density_index × 0.25 + proximity_norm × 0.25 + infra_weight × 0.15) × 100
```

| Parameter | Range | How to compute |
|---|---|---|
| `severity_norm` | 0–1 | `incident.severity / 5` |
| `density_index` | 0–1 | Population density at location, normalized (from seed data) |
| `proximity_norm` | 0–1 | `1 - (distance_to_nearest_unit_km / 20)` — clamp to 0 if > 20 km |
| `infra_weight` | 0–1 | Static tag: hospital = 1.0, main road = 0.5, residential = 0.2 |

Weights stored in `config.py` `WEIGHTS` dict, tunable at runtime.

---

## Scenario Manifest Format

```json
{
  "scenario": "flood",
  "description": "Urban flash flood in low-lying sectors",
  "ticks": [
    {
      "tick": 1,
      "delay_seconds": 0,
      "new_incidents": [
        {
          "type": "flood",
          "severity": 3,
          "lat": 28.60,
          "lng": 77.22,
          "location_desc": "Description",
          "density_index": 0.7,
          "infra_weight": 0.5,
          "required_skills": ["extraction"]
        }
      ],
      "hazard_updates": [
        { "id": "hz_001", "polygon": [[28.61, 77.20], [28.62, 77.21]] }
      ]
    }
  ]
}
```

Each incident in `new_incidents` must include: `type`, `severity`, `lat`, `lng`, `location_desc`, `density_index`, `infra_weight`, `required_skills`. The backend auto-assigns `id`, `reported_at`, and `priority_score`.

---

## Environment Variables

| Variable | Default | Used by |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000` | Frontend |

---

## Branch Naming

- `track/backend` — Backend
- `track/frontend` — Frontend
- `track/data` — Data & Simulation
- `track/integration` — Integration & QA
