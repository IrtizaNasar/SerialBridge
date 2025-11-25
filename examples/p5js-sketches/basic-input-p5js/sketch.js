// Serial Bridge Example - P5.js Sketch
// This sketch test if any data is coming from Arduino via the Bridge

let bridge;
let sensorValue = 0;
let isConnected = false;
let connectionStatus = 'disconnected';

function setup() {
    let canvas = createCanvas(400, 400);
    canvas.parent('canvas-container');
    // Connect to Serial Bridge
    bridge = new SerialBridge(); // Auto-detects URL from socket.io script
    // OR: bridge = new SerialBridge('http://localhost:3000');

    // Listen for data from device_1
    bridge.onData('device_1', (data) => {
        sensorValue = parseInt(data);
    });

    // Listen for connection status changes
    bridge.onStatus('device_1', (status, port) => {
        connectionStatus = status;
        isConnected = (status === 'connected');
        console.log(`Arduino status: ${status} on ${port}`);
    });

    console.log('P5.js sketch initialized');
    console.log('Waiting for Arduino data...');
}

function draw() {
    background(220);

    // Connection status indicator
    let statusColor = isConnected ? color(16, 185, 129) : color(239, 68, 68);
    fill(statusColor);
    circle(width / 2, 55, 12);

    textSize(12);
    fill(150);
    text(connectionStatus.toUpperCase(), width / 2, 75);

    if (isConnected) {
        // Visualize the sensor data
        fill(0, 255, 0);
        let s = map(sensorValue, 0, 1023, 0, height);
        ellipse(width / 2, height / 2, s, s);

        fill(0);
        textAlign(CENTER, CENTER);
        text(`Value: ${sensorValue}`, width / 2, height / 2);
    }
    else {
        textSize(12);
        text('Make sure Serial Bridge is running and device_1 is connected', width / 2, height / 2 + 10);
    }
}