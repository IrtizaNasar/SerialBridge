// Serial Bridge Example - P5.js Sketch
// This sketch test if any data is coming from Arduino via the Bridge

let bridge;
let sensorValue = 0;

function setup() {
    createCanvas(400, 400);

    // Connect to Serial Bridge
    bridge = new SerialBridge(); // Auto-detects URL from socket.io script
    // OR: bridge = new SerialBridge('http://localhost:3000');

    // Listen for data from arduino_1
    bridge.onData('arduino_1', (data) => {
        sensorValue = parseInt(data);
    });
}

function draw() {
    background(220);

    // Visualize the sensor data
    let s = map(sensorValue, 0, 1023, 0, height);
    ellipse(width / 2, height/2, s, s);

    textAlign(CENTER, CENTER);
    text(`Value: ${sensorValue}`, width / 2, height / 2);
}