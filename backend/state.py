# State module - now primarily handles memory-only state like events
# Incidents, Resources, and Assignments are now in SQLite

EVENT_LOG = []
HAZARD_ZONES = []

# Cache-like access if needed, but we'll mostly use database.py
INCIDENTS = {} 
RESOURCES = {}
ASSIGNMENTS = {}

AUTO_DISPATCH = True
