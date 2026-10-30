let vData = null;
let frozen = false;
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const stat = document.getElementById('stat');

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
        stat.innerText = "Hand detected! Click Freeze or type word.";
    } else {
        vData = null;
        stat.innerText = "No hand found.";
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
    stat.innerText = frozen ? "Sign frozen! Safe to type now." : "Waiting for hand...";
}

async function sendSign() {
    let name = document.getElementById('wordIn').value.trim();
    if (!name || !vData) { alert("Type a word and show your hand!"); return; }
    let res = await fetch('/api/submit_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: name, vector_array: vData })
    });
    let d = await res.json();
    alert(d.message);
    document.getElementById('wordIn').value = '';
    if (frozen) toggleFreeze();
}