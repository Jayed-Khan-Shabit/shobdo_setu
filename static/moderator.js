let vData = null;
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');

const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults((res) => {
    if (res.image) { canvas.width = res.image.width; canvas.height = res.image.height; }
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        let tempV = [];
        res.multiHandLandmarks.forEach(marks => {
            drawConnectors(ctx, marks, HAND_CONNECTIONS, {color: '#00ff00', lineWidth: 2});
            drawLandmarks(ctx, marks, {color: '#ff0000', lineWidth: 1, radius: 3});
            
            let wrist = marks[0];
            let dx = marks[9].x - wrist.x, dy = marks[9].y - wrist.y, dz = marks[9].z - wrist.z;
            let scale = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
            marks.forEach(p => {
                tempV.push(parseFloat(((p.x - wrist.x)/scale).toFixed(3)), parseFloat(((p.y - wrist.y)/scale).toFixed(3)), parseFloat(((p.z - wrist.z)/scale).toFixed(3)));
            });
        });
        vData = JSON.stringify(tempV);
    } else {
        vData = null;
    }
    ctx.restore();
});

const cam = new Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width: 1280, height: 720
});
cam.start();

async function addOfficial() {
    let name = document.getElementById('offName').value.trim();
    if (!name || !vData) { alert("Enter name and show hand!"); return; }
    let res = await fetch('/api/moderator_add_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: name, vector_array: vData })
    });
    let d = await res.json();
    alert(d.message);
    document.getElementById('offName').value = '';
    loadAll();
}

async function loadAll() {
    let pRes = await fetch('/api/get_pending_gestures');
    let pend = await pRes.json();
    let pDiv = document.getElementById('pendDiv');
    pDiv.innerHTML = pend.length === 0 ? '<p>No pending signs.</p>' : '';
    pend.forEach(i => {
        pDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding:8px; background:#f9f9f9; border-radius:6px;">
            <span><b>${i.sign_name}</b></span>
            <div>
                <button class="btn-green" style="padding:6px 12px; margin-right:4px;" onclick="doAppr(${i.gesture_id})">Approve</button>
                <button class="btn-red" style="padding:6px 12px;" onclick="doDel(${i.gesture_id})">Delete</button>
            </div>
        </div>`;
    });

    let aRes = await fetch('/api/get_approved_gestures');
    let appr = await aRes.json();
    let aDiv = document.getElementById('apprDiv');
    aDiv.innerHTML = appr.length === 0 ? '<p>No approved signs.</p>' : '';
    appr.forEach(i => {
        aDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding:8px; background:#f9f9f9; border-radius:6px;">
            <span><b>${i.sign_name}</b></span>
            <button class="btn-red" style="padding:6px 12px;" onclick="doDel(${i.gesture_id})">Delete</button>
        </div>`;
    });
}

async function doAppr(id) {
    await fetch(`/api/approve_gesture/${id}`, { method: 'POST' });
    loadAll();
}

async function doDel(id) {
    await fetch(`/api/delete_gesture/${id}`, { method: 'POST' });
    loadAll();
}

loadAll();