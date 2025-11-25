let bridge;
let sensorValue = 0;

function setup() {
    createCanvas(400, 400);

    // Connect to Serial Bridge

    bridge = new SerialBridge(); // Auto-detects URL from socket.io script
    // OR: bridge = new SerialBridge('http://localhost:3000');

    // Listen for data from device_1
    bridge.onData('device_1', (data) => {
        sensorValue = parseInt(data);
    });
}

function draw() {
    background(220);

    // Visualize the sensor data
    let h = map(sensorValue, 0, 1023, 0, height);
    rect(width / 2 - 25, height - h, 50, h);

    text(`Value: ${sensorValue}`, 10, 20);
}