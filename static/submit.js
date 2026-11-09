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
    statusText.innerText = isFrozen ? "Sign Frozen! Ready to submit." : "Show hand to camera";
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
        statusText.innerText = "Hand Captured! Click Freeze or Submit.";
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

async function submitGesture() {
    let name = document.getElementById('signName').value.trim();
    if (!name || !latestVec) {
        alert("Please capture a hand sign and enter a word!");
        return;
    }
    let res = await fetch('/api/submit_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: name, vector: latestVec, direct_approve: false })
    });
    if (res.ok) {
        alert("Submitted to Moderator Queue!");
        document.getElementById('signName').value = "";
        if (isFrozen) toggleFreeze();
    } else {
        alert("Submission failed.");
    }
}