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
        document.getElementById('stat').innerText = "Hand detected! Ready to save.";
    } else {
        vData = null;
        document.getElementById('stat').innerText = "No hand found.";
    }
    ctx.restore();
});

const cam = new Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width: 1280, height: 720
});
cam.start();

async function sendSign() {
    let name = document.getElementById('wordIn').value.trim();
    if (!name || !vData) {
        alert("Type a word and show your hand!");
        return;
    }
    let res = await fetch('/api/submit_gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: name, vector_array: vData })
    });
    let d = await res.json();
    alert(d.message);
    document.getElementById('wordIn').value = '';
}