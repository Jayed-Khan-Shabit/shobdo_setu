import sqlite3
import json
import random

conn = sqlite3.connect('gestures.db')
cursor = conn.cursor()

cursor.execute('''CREATE TABLE IF NOT EXISTS gestures 
            (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, vec TEXT, status TEXT)''')

words = ["Apple", "Water", "Help", "Hello", "Thanks", "Yes", "No", "Please", "Sorry", "Eat"]

for i in range(1000):
    dummy_vector = [round(random.uniform(-1.0, 1.0), 3) for _ in range(63)]
    vector_json = json.dumps(dummy_vector)
    sign_name = f"{random.choice(words)}_{i}"
    cursor.execute("INSERT INTO gestures (name, vec, status) VALUES (?, ?, 'approved')", (sign_name, vector_json))

conn.commit()
conn.close()