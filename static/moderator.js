let latestVec = null;
let isFrozen = false;

const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('statusText');
const freezeBtn = document.getElementById('freezeBtn');

function getVec(marks) {
    let w = marks[0];
    let dx = marks[9].x - w.x, dy = marks[9].y - w.y, dz = marks[9].z - w.z;
    let scale = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    let v = [];
    for (let i = 0; i < marks.length; i++) {
        v.push(
            +(Math.abs(marks[i].x - w.x) / scale).toFixed(3),
            +((marks[i].y - w.y) / scale).toFixed(3),
            +(((marks[i].z - w.z) / scale) * 0.3).toFixed(3)
        );
    }
    return v;
}

function toggleFreeze() {
    if (!latestVec && !isFrozen) {
        alert("Detect a hand first before freezing!");
        return;
    }
    isFrozen = !isFrozen;
    freezeBtn.innerText = isFrozen ? "Unfreeze Sign" : "Freeze Sign";
    statusText.innerText = isFrozen ? "Sign Frozen! Ready to publish." : "Show hand to camera";
    statusText.style.color = isFrozen ? "#fd7e14" : "#007bff";
}

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults(res => {
    if (isFrozen) return;
    canvas.width = res.image.width;
    canvas.height = res.image.height;
    ctx.drawImage(res.image, 0, 0);

    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
        let marks = res.multiHandLandmarks[0];
        drawConnectors(ctx, marks, HAND_CONNECTIONS, { color: '#00ff00', lineWidth: 2 });
        drawLandmarks(ctx, marks, { color: '#ff0000', lineWidth: 1, radius: 3 });
        latestVec = getVec(marks);
        statusText.innerText = "Hand Captured! Click Freeze or Publish.";
        statusText.style.color = "#28a745";
    } else {
        latestVec = null;
        statusText.innerText = "No hand detected";
        statusText.style.color = "#dc3545";
    }
});

new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640, height: 480
}).start();

async function publishOfficial() {
    let name = document.getElementById('signName').value.trim();
    if (!name || !latestVec) {
        alert("Please capture a hand sign and enter a word!");
        return;
    }
    let res = await fetch('/api/submit_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: name, vector: latestVec, direct_approve: true })
    });
    if (res.ok) {
        alert("Official sign '" + name + "' published successfully!");
        document.getElementById('signName').value = "";
        if (isFrozen) toggleFreeze();
        loadLists();
    } else {
        alert("Failed to publish official sign.");
    }
}

async function modAction(id, action) {
    if (action === 'delete' && !confirm("Are you sure you want to delete this sign?")) {
        return;
    }
    let res = await fetch('/api/moderate_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, action: action })
    });
    if (res.ok) {
        alert(action === 'approve' ? "Sign approved and added to dictionary!" : "Sign deleted successfully!");
        loadLists();
    } else {
        alert("Action failed.");
    }
}

async function loadLists() {
    let pRes = await fetch('/api/get_pending_gestures');
    let oRes = await fetch('/api/get_official_gestures');
    if (!pRes.ok || !oRes.ok) return;

    let pending = await pRes.json();
    let official = await oRes.json();

    let pDiv = document.getElementById('pendingList');
    pDiv.innerHTML = pending.length ? "" : "<p>No pending signs.</p>";
    pending.forEach(item => {
        let row = document.createElement('div');
        row.className = 'item-row';
        let span = document.createElement('span');
        span.textContent = item.sign_name;
        let btnGroup = document.createElement('div');
        btnGroup.innerHTML = `<button class="btn-green" onclick="modAction(${item.id}, 'approve')">Approve</button>
                              <button class="btn-red" onclick="modAction(${item.id}, 'delete')">Reject</button>`;
        row.appendChild(span);
        row.appendChild(btnGroup);
        pDiv.appendChild(row);
    });

    let oDiv = document.getElementById('officialList');
    oDiv.innerHTML = official.length ? "" : "<p>No approved signs yet.</p>";
    official.forEach(item => {
        let row = document.createElement('div');
        row.className = 'item-row';
        let span = document.createElement('span');
        span.textContent = item.sign_name;
        let btn = document.createElement('button');
        btn.className = 'btn-red';
        btn.textContent = 'Delete';
        btn.onclick = () => modAction(item.id, 'delete');
        row.appendChild(span);
        row.appendChild(btn);
        oDiv.appendChild(row);
    });
}

loadLists();