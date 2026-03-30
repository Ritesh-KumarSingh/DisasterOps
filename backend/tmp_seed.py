import sys
import os

# Ensure backend modules can be imported
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import database as db

users = [
    ("citizen1", "citizen"),
    ("citizen2", "citizen"),
    ("citizen3", "citizen"),
    ("responder1", "responder"),
    ("responder2", "responder"),
    ("responder3", "responder"),
    ("admin1", "operator"),
    ("admin2", "operator")
]

db.init_db()

for u, r in users:
    res = db.create_user(u, "", r)
    print(f"Created {u} ({r}): {res}")

print("Successfully seeded 3 citizens, 3 responders, 2 operators.")
