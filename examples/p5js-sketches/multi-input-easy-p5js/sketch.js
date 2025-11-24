// Serial Bridge Example - P5.js Sketch
// This sketch receives TWO values from Arduino and uses them to control shapes

let bridge;
let sensor1Value = 0;
let sensor2Value = 0;
let isConnected = false;
let connectionStatus = 'disconnected';

function setup() {
    let canvas = createCanvas(400, 400);
    canvas.parent('canvas-container');

    // Connect to Serial Bridge
    bridge = new SerialBridge(); // Auto-detects URL from socket.io script

    // Listen for data from arduino_1
    //This is an event listener that runs every time new data arrives.
    bridge.onData('arduino_1', (data) => {
        // Console log the raw data as it arrives
        console.log("Raw data received:", data);

        // Split the data by comma to separate the two values
        let values = data.split(",");

        // Console log the split values
        console.log("Split values:", values);

        // Convert the string values to numbers
        sensor1Value = parseInt(values[0]);
        sensor2Value = parseInt(values[1]);

        // Console log the parsed numbers
        console.log("Sensor 1:", sensor1Value, "Sensor 2:", sensor2Value);
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
        // Use sensor1 to control the ellipse size
        let ellipseSize = map(sensor1Value, 0, 1023, 20, 200);
        fill(100, 150, 255);
        ellipse(130, height / 2, ellipseSize, ellipseSize);

        // Use sensor2 to control the square size
        let squareSize = map(sensor2Value, 0, 1023, 20, 200);
        fill(255, 150, 100);
        rectMode(CENTER);
        square(280, height / 2, squareSize);

        // Display the values on screen
        fill(0);
        textAlign(LEFT, TOP);
        textSize(14);
        text(`Sensor 1: ${sensor1Value}`, 10, 10);
        text(`Sensor 2: ${sensor2Value}`, 10, 30);
        text(`Ellipse size: ${ellipseSize}`, 10, 60);
        text(`Square size: ${squareSize}`, 10, 80);
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