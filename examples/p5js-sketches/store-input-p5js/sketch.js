// Serial Bridge Example - Single Sensor with JSON Array
// This sketch collects ALL sensor readings in an array

let bridge;
let sensorValue = 0;
let allData = []; // Array to store all readings
let sensorData;
let isConnected = false;
let connectionStatus = 'disconnected';


function setup() {
    let canvas = createCanvas(400, 400);
    canvas.parent('canvas-container');

    // Connect to Serial Bridge
    bridge = new SerialBridge();

    // Listen for data from device_1
    bridge.onData('device_1', (data) => {
        console.log(data);
        // Parse the incoming value
        sensorValue = parseInt(data);

        // Create a JSON object for this reading
        sensorData = {
            value: sensorValue,
            timestamp: millis()
        };

        // Add it to our array of all readings
        allData.push(sensorData);

        // Console log the current reading
        console.log("New reading:", sensorData);
        console.log("Total readings collected:", allData.length);
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
    connectionDisplay();

    if (isConnected) {
        // Use sensor to control the ellipse size
        let ellipseSize = map(sensorValue, 0, 1023, 20, 300);
        fill(100, 150, 255);
        ellipse(width / 2, height / 2, ellipseSize, ellipseSize);

        // Display the current value
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(20);
        text(`Value: ${sensorValue}`, width / 2, height / 2);

        // Display JSON data on screen
        textAlign(LEFT, TOP);
        textSize(12);
        text("JSON Object:", 10, 10);
        // Only display if sensorData has been created
        if (sensorData) {
            text(`{ value: ${sensorData.value}, timestamp: ${sensorData.timestamp} }`, 10, 30);
        } else {
            text("Waiting for data...", 10, 30);
        }
        // Display how many readings we've collected
        textAlign(LEFT, TOP);
        textSize(14);
        text(`Readings collected: ${allData.length}`, 10, 60);
        text(`Press 's' to save all data`, 10, 80);
    }
    else {
        textSize(12);
        text('Make sure Serial Bridge is running and device_1 is connected', width / 2, height / 2 + 10);
    }
}

// Press 's' key to save ALL collected data to a JSON file
function keyPressed() {
    if (key === 's' || key === 'S') {
        saveJSON(allData, 'all-sensor-data.json');
        console.log(`Saved ${allData.length} readings to file!`);
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