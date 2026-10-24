from flask import Flask, render_template, request, jsonify
import sqlite3

app = Flask(__name__)
fn = 'gestures.db'

def run_sql(query, args=(), get_data=False):
    db = sqlite3.connect(fn)
    cur = db.cursor()
    cur.execute(query, args)
    db.commit()
    data = cur.fetchall() if get_data else None
    db.close()
    return data

run_sql('''CREATE TABLE IF NOT EXISTS gestures 
            (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, vec TEXT, status TEXT)''')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/submit')
def sub():
    return render_template('submit.html')

@app.route('/moderator')
def mod():
    return render_template('moderator.html')

@app.route('/api/get_approved_gestures')
def get_appr():
    rows = run_sql("SELECT id, name, vec FROM gestures WHERE status='approved'", get_data=True)
    out = []
    for r in (rows or []):
        out.append({'gesture_id': r[0], 'sign_name': r[1], 'vector_array': r[2]})
    return jsonify(out)

@app.route('/api/get_pending_gestures')
def get_pend():
    rows = run_sql("SELECT id, name, vec FROM gestures WHERE status='pending'", get_data=True)
    out = []
    for r in (rows or []):
        out.append({'gesture_id': r[0], 'sign_name': r[1], 'vector_array': r[2]})
    return jsonify(out)

@app.route('/api/submit_gesture', methods=['POST'])
def add_pend():
    d = request.json
    run_sql("INSERT INTO gestures (name, vec, status) VALUES (?, ?, 'pending')", (d['sign_name'], d['vector_array']))
    return jsonify({'message': 'Submitted successfully!'})

@app.route('/api/moderator_add_gesture', methods=['POST'])
def add_off():
    d = request.json
    run_sql("INSERT INTO gestures (name, vec, status) VALUES (?, ?, 'approved')", (d['sign_name'], d['vector_array']))
    return jsonify({'message': 'Official sign added!'})

@app.route('/api/approve_gesture/<int:id>', methods=['POST'])
def appr_g(id):
    run_sql("UPDATE gestures SET status='approved' WHERE id=?", (id,))
    return jsonify({'message': 'Approved!'})

@app.route('/api/delete_gesture/<int:id>', methods=['POST'])
def del_g(id):
    run_sql("DELETE FROM gestures WHERE id=?", (id,))
    return jsonify({'message': 'Deleted!'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)