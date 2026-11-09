let signs = [];
let sentence = [];
let currWord = "";
let holdCount = 0;
let lastAdded = "";

const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const wordBox = document.getElementById('wordBox');
const sentenceBox = document.getElementById('sentenceBox');
const perfBox = document.getElementById('perfBox');
const countBox = document.getElementById('countBox');

fetch('/api/get_approved_gestures')
    .then(r => r.json())
    .then(data => {
        signs = data.map(i => ({ name: i.sign_name, vec: JSON.parse(i.vector_array) }));
        if (countBox) countBox.innerText = signs.length;
    });

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

function findMatch(live) {
    let t0 = performance.now();
    let best = null, maxSim = 0;
    for (let s of signs) {
        if (s.vec.length !== live.length) continue;
        let dot = 0, nA = 0, nB = 0;
        for (let i = 0; i < live.length; i++) {
            dot += live[i] * s.vec[i];
            nA += live[i] * live[i];
            nB += s.vec[i] * s.vec[i];
        }
        let sim = dot / (Math.sqrt(nA) * Math.sqrt(nB) || 1);
        if (sim > maxSim) { maxSim = sim; best = s.name; }
    }
    let t1 = performance.now();
    if (perfBox) perfBox.innerText = (t1 - t0).toFixed(2);
    return maxSim > 0.93 ? best : null;
}

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults(res => {
    canvas.width = res.image.width;
    canvas.height = res.image.height;
    ctx.drawImage(res.image, 0, 0);

    if (!res.multiHandLandmarks || !res.multiHandLandmarks[0]) {
        wordBox.innerText = "No hand found";
        wordBox.style.color = "#007bff";
        currWord = "";
        holdCount = 0;
        lastAdded = "";
        return;
    }

    let marks = res.multiHandLandmarks[0];
    drawConnectors(ctx, marks, HAND_CONNECTIONS, { color: '#00ff00', lineWidth: 2 });
    drawLandmarks(ctx, marks, { color: '#ff0000', lineWidth: 1, radius: 3 });

    let match = findMatch(getVec(marks));
    if (match) {
        wordBox.innerText = match;
        wordBox.style.color = "#28a745";

        if (match === currWord) {
            holdCount++;
            if (holdCount === 15 && match !== lastAdded) {
                sentence.push(match);
                lastAdded = match;
                sentenceBox.innerText = sentence.join(" ");
            }
        } else {
            currWord = match;
            holdCount = 1;
        }
    } else {
        wordBox.innerText = "Unrecognized";
        wordBox.style.color = "#dc3545";
        currWord = "";
        holdCount = 0;
        lastAdded = "";
    }
});

new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640, height: 480
}).start();

function undoText() {
    sentence.pop();
    lastAdded = "";
    sentenceBox.innerText = sentence.length ? sentence.join(" ") : "Start signing...";
}

function clearText() {
    sentence = [];
    lastAdded = "";
    sentenceBox.innerText = "Start signing...";
}

window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

async function speakText() {
    if (!sentence.length) return;
    let fullText = sentence.join(" ");

    try {
        let res = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: fullText })
        });
        if (res.ok) {
            let blob = await res.blob();
            let audio = new Audio(URL.createObjectURL(blob));
            audio.play();
            return;
        }
    } catch (e) { }

    window.speechSynthesis.cancel();
    let msg = new SpeechSynthesisUtterance(fullText);
    let voices = window.speechSynthesis.getVoices();
    let bestVoice = voices.find(v => v.name.includes("Google") || v.lang === "en-US");
    if (bestVoice) msg.voice = bestVoice;
    msg.rate = 0.95;
    window.speechSynthesis.speak(msg);
}