let signs = [];
let sentence = [];
let currWord = "";
let holdCount = 0;
let lastAdded = "";

async function init() {
    let res = await fetch('/api/get_approved_gestures');
    let data = await res.json();
    signs = data.map(item => ({ sign_name: item.sign_name, vector: JSON.parse(item.vector_array) }));
    startWebcam();
}

function startWebcam() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('output_canvas');
    const ctx = canvas.getContext('2d');

    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

    hands.onResults((res) => {
        if (res.image) {
            canvas.width = res.image.width;
            canvas.height = res.image.height;
        }
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

        if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
            res.multiHandLandmarks.forEach(marks => {
                drawConnectors(ctx, marks, HAND_CONNECTIONS, {color: '#00ff00', lineWidth: 2});
                drawLandmarks(ctx, marks, {color: '#ff0000', lineWidth: 1, radius: 3});
            });
            processHands(res.multiHandLandmarks);
        } else {
            processHands(null);
        }
        ctx.restore();
    });

    const cam = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }); },
        width: 1280, height: 720
    });
    cam.start();
}

function getHandVector(marks) {
    let wrist = marks[0];
    let dx = marks[9].x - wrist.x;
    let dy = marks[9].y - wrist.y;
    let dz = marks[9].z - wrist.z;
    let scale = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

    let vec = [];
    marks.forEach(p => {
        vec.push(
            parseFloat(((p.x - wrist.x)/scale).toFixed(3)),
            parseFloat(((p.y - wrist.y)/scale).toFixed(3)),
            parseFloat(((p.z - wrist.z)/scale).toFixed(3))
        );
    });
    return vec;
}

function findBestMatch(liveVec) {
    let bestMatch = null;
    let highestSim = 0;

    signs.forEach(item => {
        let dbVec = item.vector;
        if (liveVec.length === dbVec.length) {
            let dot = 0, nA = 0, nB = 0;
            for (let i = 0; i < liveVec.length; i++) {
                dot += liveVec[i] * dbVec[i];
                nA += liveVec[i] * liveVec[i];
                nB += dbVec[i] * dbVec[i];
            }
            let sim = (nA === 0 || nB === 0) ? 0 : dot / (Math.sqrt(nA) * Math.sqrt(nB));
            if (sim > highestSim) {
                highestSim = sim;
                bestMatch = item.sign_name;
            }
        }
    });
    return highestSim > 0.93 ? bestMatch : null;
}

function processHands(handsData) {
    let box = document.getElementById('wordBox');

    if (!handsData) {
        box.innerText = "No hand found";
        currWord = "";
        holdCount = 0;
        lastAdded = "";
        return;
    }

    let liveVec = [];
    handsData.forEach(m => { liveVec.push(...getHandVector(m)); });

    let match = findBestMatch(liveVec);

    if (match) {
        box.innerText = match;
        box.style.color = "#28a745";

        if (match === currWord) {
            holdCount++;
            if (holdCount === 20 && match !== lastAdded) {
                sentence.push(match);
                lastAdded = match;
                document.getElementById('sentenceBox').innerText = sentence.join(" ");
            }
        } else {
            currWord = match;
            holdCount = 0;
        }
    } else {
        box.innerText = "Unrecognized";
        box.style.color = "#dc3545";
        currWord = "";
        holdCount = 0;
    }
}

function undoText() {
    sentence.pop();
    lastAdded = "";
    document.getElementById('sentenceBox').innerText = sentence.length === 0 ? "Start signing..." : sentence.join(" ");
}

function clearText() {
    sentence = [];
    lastAdded = "";
    document.getElementById('sentenceBox').innerText = "Start signing...";
}

function speakText() {
    if (sentence.length === 0) return;
    let speech = new SpeechSynthesisUtterance(sentence.join(" "));
    window.speechSynthesis.speak(speech);
}

init();