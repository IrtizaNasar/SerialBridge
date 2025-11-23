// Serial Bridge Example - Multiple Sensors with Arrays
// This sketch receives MULTIPLE values from Arduino

let bridge;
let sensorValues = [0, 0, 0]; // Array to hold all sensor values
let isConnected = false;
let connectionStatus = 'disconnected';

function setup() {
    let canvas = createCanvas(400, 400);
    canvas.parent('canvas-container');

    // Connect to Serial Bridge
    bridge = new SerialBridge();

    // Listen for data from arduino_1
    bridge.onData('arduino_1', (data) => {
        // Console log the raw data as it arrives
        console.log("Raw data received:", data);

        // Split the data by comma
        let values = data.split(",");

        // Console log the split values
        console.log("Split values:", values);

        // Loop through and convert all values to numbers
        for (let i = 0; i < values.length; i++) {
            sensorValues[i] = parseInt(values[i]);
        }

        // Console log all sensor values
        console.log("All sensors:", sensorValues);
    });

    // Listen for connection status changes
    bridge.onStatus('arduino_1', (status, port) => {
        connectionStatus = status;
        isConnected = (status === 'connected');
        console.log(`Arduino status: ${status} on ${port}`);
    });

    console.log('P5.js sketch initialized');
    console.log('Waiting for Arduino data...');
}

function draw() {
    background(220);
    connectionDisplay();

    if (isConnected) {
        // Use sensor 0 to control the ellipse size
        let ellipseSize = map(sensorValues[0], 0, 1023, 20, 200);
        fill(100, 150, 255);
        ellipse(100, height / 2, ellipseSize, ellipseSize);

        // Use sensor 1 to control the square size
        let squareSize = map(sensorValues[1], 0, 1023, 20, 200);
        fill(255, 150, 100);
        rectMode(CENTER);
        square(200, height / 2, squareSize);

        // Use sensor 2 to control a triangle size
        let triangleSize = map(sensorValues[2], 0, 1023, 20, 200);
        fill(150, 255, 150);
        triangle(300, height / 2 - triangleSize / 2,
            300 - triangleSize / 2, height / 2 + triangleSize / 2,
            300 + triangleSize / 2, height / 2 + triangleSize / 2);

        // Display all values on screen
        fill(0);
        textAlign(LEFT, TOP);
        textSize(14);
        for (let i = 0; i < sensorValues.length; i++) {
            text(`Sensor ${i}: ${sensorValues[i]}`, 10, 10 + (i * 20));
        }
    }

    else {
        textSize(12);
        text('Make sure Serial Bridge is running and arduino_1 is connected', width / 2, height / 2 + 10);
    }
}

function connectionDisplay() {
    // Connection status indicator
    let statusColor = isConnected ? color(16, 185, 129) : color(239, 68, 68);
    fill(statusColor);
    circle(width / 2, height - 55, 12);

    textAlign(CENTER, CENTER);
    textSize(12);
    fill(150);
    text(connectionStatus.toUpperCase(), width / 2, height - 30);
}