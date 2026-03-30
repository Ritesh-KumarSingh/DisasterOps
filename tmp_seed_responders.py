import sqlite3
import os

# Absolute path based on the user information
DB_PATH = r"c:\Users\Ritesh\Desktop\DisasterOps\backend\disaster_ops.db"

responders = [
    ("police_unit_1", "responder"),
    ("police_unit_2", "responder"),
    ("police_unit_3", "responder"),
    ("police_unit_4", "responder"),
    ("fire_engine_1", "responder"),
    ("fire_engine_2", "responder"),
    ("fire_engine_3", "responder"),
    ("ambulance_1", "responder"),
    ("ambulance_2", "responder"),
    ("ambulance_3", "responder"),
]

def seed_responders():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    count = 0
    for username, role in responders:
        try:
            # We use empty password_hash as the current system bypasses password checks if empty
            cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, "", role))
            print(f"Provisioned {username} ({role})")
            count += 1
        except sqlite3.IntegrityError:
            print(f"User {username} already exists (skipping).")
            
    conn.commit()
    conn.close()
    print(f"\nSuccessfully provisioned {count} new responder accounts.")

if __name__ == "__main__":
    seed_responders()
