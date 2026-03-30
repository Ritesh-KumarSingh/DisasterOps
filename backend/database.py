import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "disaster_ops.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')
    
    # Incidents table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        location_desc TEXT,
        reported_at TEXT NOT NULL,
        status TEXT NOT NULL,
        priority_score INTEGER,
        assigned_resource_id TEXT,
        density_index REAL,
        infra_weight REAL,
        required_skills TEXT,
        score_breakdown TEXT,
        backup_requested INTEGER DEFAULT 0
    )
    ''')

    # Migration: Add backup_requested column if it doesn't exist (for existing DBs)
    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN backup_requested INTEGER DEFAULT 0")
        conn.commit()
    except sqlite3.OperationalError:
        # Column already exists, skip
        pass
    
    # Resources table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        agency TEXT NOT NULL,
        unit_name TEXT NOT NULL,
        capacity INTEGER,
        current_load INTEGER,
        status TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        eta_minutes INTEGER,
        skills TEXT
    )
    ''')
    
    # Assignments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        eta_minutes INTEGER,
        status TEXT NOT NULL,
        override_by_operator BOOLEAN,
        reason TEXT
    )
    ''')

    # Disaster Events table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS disaster_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        location_name TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        severity INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        metadata TEXT
    )
    ''')

    # Event Zones table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS event_zones (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        name TEXT,
        type TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radius_km REAL NOT NULL
    )
    ''')

    # Event Tasks table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS event_tasks (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        title TEXT NOT NULL,
        assigned_to TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')


    conn.commit()
    conn.close()

def save_incident(incident):
    conn = get_db()
    cursor = conn.cursor()
    
    # Serialize complex fields
    skills = json.dumps(incident.get("required_skills", []))
    breakdown = json.dumps(incident.get("score_breakdown", {}))
    
    cursor.execute('''
    INSERT OR REPLACE INTO incidents (
        id, type, severity, lat, lng, location_desc, reported_at, status, 
        priority_score, assigned_resource_id, density_index, infra_weight, 
        required_skills, score_breakdown, backup_requested
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        incident["id"], incident["type"], incident["severity"], incident["lat"], 
        incident["lng"], incident["location_desc"], incident["reported_at"], 
        incident["status"], incident["priority_score"], incident["assigned_resource_id"],
        incident["density_index"], incident["infra_weight"], skills, breakdown,
        1 if incident.get("backup_requested") else 0
    ))
    conn.commit()
    conn.close()

def get_all_incidents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents")
    rows = cursor.fetchall()
    conn.close()
    
    incidents = []
    for row in rows:
        inc = dict(row)
        inc["required_skills"] = json.loads(inc["required_skills"]) if inc["required_skills"] else []
        inc["score_breakdown"] = json.loads(inc["score_breakdown"]) if inc["score_breakdown"] else {}
        incidents.append(inc)
    return incidents

def save_resource(resource):
    conn = get_db()
    cursor = conn.cursor()
    skills = json.dumps(resource.get("skills", []))
    cursor.execute('''
    INSERT OR REPLACE INTO resources (
        id, agency, unit_name, capacity, current_load, status, lat, lng, eta_minutes, skills
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        resource["id"], resource["agency"], resource["unit_name"], resource.get("capacity", 0),
        resource.get("current_load", 0), resource["status"], resource["lat"], 
        resource["lng"], resource.get("eta_minutes"), skills
    ))
    conn.commit()
    conn.close()

def get_all_resources():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resources")
    rows = cursor.fetchall()
    conn.close()
    
    resources = []
    for row in rows:
        res = dict(row)
        res["skills"] = json.loads(res["skills"]) if res["skills"] else []
        resources.append(res)
    return resources

def save_assignment(assignment):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT OR REPLACE INTO assignments (
        id, incident_id, resource_id, created_at, eta_minutes, status, override_by_operator, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        assignment["id"], assignment["incident_id"], assignment["resource_id"], 
        assignment["created_at"], assignment["eta_minutes"], assignment["status"], 
        assignment["override_by_operator"], assignment["reason"]
    ))
    conn.commit()
    conn.close()

def delete_assignment(assignment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
    conn.commit()
    conn.close()

def get_all_assignments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assignments")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(username: str, password: str, role: str) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    try:
        pw_hash = hash_password(password)
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, pw_hash, role))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"error": "Username already exists"}
    
    conn.close()
    return {"message": "User created successfully"}

def verify_user(username: str, password: str) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, password_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row["password_hash"] == hash_password(password):
        return {"status": "success", "role": row["role"]}
    return {"status": "error", "message": "Invalid username or password"}

# --- DISASTER EVENTS CRUD ---

def save_disaster_event(event):
    conn = get_db()
    cursor = conn.cursor()
    metadata = json.dumps(event.get("metadata", {}))
    cursor.execute('''
    INSERT OR REPLACE INTO disaster_events (
        id, type, location_name, lat, lng, severity, status, created_by, created_at, resolved_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        event["id"], event["type"], event.get("location_name", ""), event["lat"], event["lng"],
        event["severity"], event["status"], event.get("created_by", ""), event["created_at"],
        event.get("resolved_at"), metadata
    ))
    conn.commit()
    conn.close()

def get_all_disaster_events():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM disaster_events ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    events = []
    for row in rows:
        ev = dict(row)
        ev["metadata"] = json.loads(ev["metadata"]) if ev["metadata"] else {}
        events.append(ev)
    return events

def get_disaster_event(event_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM disaster_events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        ev = dict(row)
        ev["metadata"] = json.loads(ev["metadata"]) if ev["metadata"] else {}
        return ev
    return None

def save_event_zone(zone):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT OR REPLACE INTO event_zones (
        id, event_id, name, type, lat, lng, radius_km
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        zone["id"], zone["event_id"], zone.get("name", ""), zone["type"],
        zone["lat"], zone["lng"], zone["radius_km"]
    ))
    conn.commit()
    conn.close()

def delete_event_zone(zone_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM event_zones WHERE id = ?", (zone_id,))
    conn.commit()
    conn.close()

def get_zones_for_event(event_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM event_zones WHERE event_id = ?", (event_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_event_zones():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM event_zones")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_event_task(task):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT OR REPLACE INTO event_tasks (
        id, event_id, title, assigned_to, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        task["id"], task["event_id"], task["title"], task.get("assigned_to"),
        task["status"], task["created_at"]
    ))
    conn.commit()
    conn.close()

def get_tasks_for_event(event_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM event_tasks WHERE event_id = ? ORDER BY created_at DESC", (event_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_event_tasks():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM event_tasks")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
