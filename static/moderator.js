let vData = null;
let frozen = false;
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults(res => {
    if (frozen) return;
    canvas.width = res.image.width;
    canvas.height = res.image.height;
    ctx.drawImage(res.image, 0, 0);

    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
        let marks = res.multiHandLandmarks[0];
        drawConnectors(ctx, marks, HAND_CONNECTIONS, { color: '#00ff00', lineWidth: 2 });
        drawLandmarks(ctx, marks, { color: '#ff0000', lineWidth: 1, radius: 3 });

        let w = marks[0];
        let dx = marks[9].x - w.x, dy = marks[9].y - w.y, dz = marks[9].z - w.z;
        let scale = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        let tempV = [];
        for (let i = 0; i < marks.length; i++) {
            tempV.push(
                +(Math.abs(marks[i].x - w.x) / scale).toFixed(3),
                +((marks[i].y - w.y) / scale).toFixed(3),
                +((marks[i].z - w.z) / scale).toFixed(3)
            );
        }
        vData = JSON.stringify(tempV);
    } else {
        vData = null;
    }
});

new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640, height: 480
}).start();

function toggleFreeze() {
    let btn = document.getElementById('freezeBtn');
    if (!frozen && !vData) { alert("Show your hand first!"); return; }
    frozen = !frozen;
    btn.innerText = frozen ? "Unfreeze Camera" : "Freeze Sign";
    btn.style.background = frozen ? "#fd7e14" : "#6c757d";
}

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
    if (frozen) toggleFreeze();
    loadAll();
}

async function loadAll() {
    let pend = await (await fetch('/api/get_pending_gestures')).json();
    let pDiv = document.getElementById('pendDiv');
    pDiv.innerHTML = pend.length ? '' : '<p>No pending signs.</p>';
    pend.forEach(i => {
        pDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding:8px; background:#f9f9f9; border-radius:6px;">
            <b>${i.sign_name}</b>
            <div>
                <button class="btn-green" style="padding:6px 12px; margin-right:4px;" onclick="modAct('/api/approve_gesture/${i.gesture_id}')">Approve</button>
                <button class="btn-red" style="padding:6px 12px;" onclick="modAct('/api/delete_gesture/${i.gesture_id}')">Delete</button>
            </div>
        </div>`;
    });

    let appr = await (await fetch('/api/get_approved_gestures')).json();
    let aDiv = document.getElementById('apprDiv');
    aDiv.innerHTML = appr.length ? '' : '<p>No approved signs.</p>';
    appr.forEach(i => {
        aDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding:8px; background:#f9f9f9; border-radius:6px;">
            <b>${i.sign_name}</b>
            <button class="btn-red" style="padding:6px 12px;" onclick="modAct('/api/delete_gesture/${i.gesture_id}')">Delete</button>
        </div>`;
    });
}

async function modAct(url) {
    await fetch(url, { method: 'POST' });
    loadAll();
}

loadAll();