// Serial Bridge Example - Send mouseX to Arduino
// Move your mouse left/right to control LED brightness

let bridge;
let isConnected = false;

function setup() {
    let canvas = createCanvas(400, 400);
    canvas.parent('canvas-container');

    // Connect to Serial Bridge
    bridge = new SerialBridge('http://localhost:3000');

    // Listen for connection status
    bridge.onStatus('device_1', (status) => {
        isConnected = (status === 'connected');
        console.log(`Arduino status: ${status}`);
    });

    console.log("P5.js ready - move mouse to control LED");
}

function draw() {
    background(220);

    // Map mouseX to LED brightness (0-255)
    let brightness = map(mouseX, 0, width, 0, 255);
    brightness = constrain(brightness, 0, 255);

    // Visualize the brightness
    fill(brightness);
    ellipse(width / 2, height / 2, 200, 200);

    // Display info
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(`Brightness: ${Math.round(brightness)}`, width / 2, height / 2);

    // Connection status
    textSize(14);
    if (isConnected) {
        fill(0, 200, 0);
        text("Connected", width / 2, 50);
    } else {
        fill(200, 0, 0);
        text("Not Connected", width / 2, 50);
    }

    textSize(12);
    fill(100);
    text("Move mouse left/right", width / 2, height - 30);
}

function mouseMoved() {
    // Only send data if connected
    if (isConnected) {
        // Map mouseX to 0-255 range
        let brightness = map(mouseX, 0, width, 0, 255);
        brightness = constrain(brightness, 0, 255);
        brightness = Math.round(brightness);

        // Send to Arduino
        bridge.send('device_1', brightness.toString());

        // Console log what we're sending
        console.log(`Sending brightness: ${brightness}`);
    }
}