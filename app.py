from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
import sqlite3
import json
import io
import os
from gtts import gTTS

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'shobdo_setu_secure_key_2026')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
fn = 'gestures.db'

def run_sql(q, args=(), fetch=False):
    with sqlite3.connect(fn) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(q, args)
        if fetch:
            return [dict(r) for r in cur.fetchall()]
        conn.commit()

run_sql('''CREATE TABLE IF NOT EXISTS gestures 
            (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, vec TEXT, status TEXT)''')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/submit')
def sub():
    return render_template('submit.html')

@app.route('/moderator-login', methods=['GET', 'POST'])
def mod_login():
    if request.method == 'POST':
        pwd = request.form.get('password', '')
        if pwd == ADMIN_PASSWORD:
            session['is_mod'] = True
            return redirect(url_for('mod'))
        return render_template('login.html', error='Invalid Admin Password')
    return render_template('login.html', error=None)

@app.route('/moderator-logout')
def mod_logout():
    session.pop('is_mod', None)
    return redirect(url_for('home'))

@app.route('/moderator')
def mod():
    if not session.get('is_mod'):
        return redirect(url_for('mod_login'))
    return render_template('moderator.html')

@app.route('/api/get_approved_gestures')
def get_ok():
    return jsonify(run_sql("SELECT name as sign_name, vec as vector_array FROM gestures WHERE status='approved'", fetch=True))

@app.route('/api/submit_gesture', methods=['POST'])
def add_g():
    d = request.get_json(silent=True) or {}
    name = str(d.get('sign_name', '')).strip()
    vec = d.get('vector', [])
    if not name or len(name) > 40 or not isinstance(vec, list) or len(vec) != 63:
        return jsonify({"error": "Invalid sign name or 63-point vector"}), 400
    st = 'approved' if (d.get('direct_approve') and session.get('is_mod')) else 'pending'
    run_sql("INSERT INTO gestures (name, vec, status) VALUES (?, ?, ?)", (name, json.dumps(vec), st))
    return jsonify({"msg": "Saved"})

@app.route('/api/get_pending_gestures')
def get_p():
    if not session.get('is_mod'):
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(run_sql("SELECT id, name as sign_name, vec as vector_array FROM gestures WHERE status='pending'", fetch=True))

@app.route('/api/get_official_gestures')
def get_off():
    if not session.get('is_mod'):
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(run_sql("SELECT id, name as sign_name FROM gestures WHERE status='approved'", fetch=True))

@app.route('/api/moderate_gesture', methods=['POST'])
def mod_g():
    if not session.get('is_mod'):
        return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json(silent=True) or {}
    action = d.get('action')
    gid = d.get('id')
    if not gid or action not in ('approve', 'delete'):
        return jsonify({"error": "Invalid request"}), 400
    if action == 'approve':
        run_sql("UPDATE gestures SET status='approved' WHERE id=?", (gid,))
    elif action == 'delete':
        run_sql("DELETE FROM gestures WHERE id=?", (gid,))
    return jsonify({"msg": "Updated"})

@app.route('/api/speak', methods=['POST'])
def speak():
    d = request.get_json(silent=True) or {}
    text = str(d.get('text', '')).strip()
    if not text:
        return jsonify({"error": "No text"}), 400
    fp = io.BytesIO()
    tts = gTTS(text=text[:300], lang='en', slow=False)
    tts.write_to_fp(fp)
    fp.seek(0)
    return send_file(fp, mimetype='audio/mpeg')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)