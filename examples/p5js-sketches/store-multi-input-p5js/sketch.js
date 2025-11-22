// Serial Bridge Example - Multiple Sensors with JSON
// This sketch receives MULTIPLE values and stores them in JSON format

let bridge;
let sensorValues = [0, 0, 0]; // Array to hold current sensor values
let allData = []; // Array to store all readings
let currentReading = {}; // Store the latest JSON object

function setup() {
    createCanvas(400, 400);

    // Connect to Serial Bridge
    bridge = new SerialBridge();

    // Listen for data from arduino_1
    bridge.onData('arduino_1', (data) => {
        // Console log the raw data as it arrives
        console.log("Raw data received:", data);

        // Split the data by comma
        let values = data.split(",");

        // Loop through and convert all values to numbers
        for (let i = 0; i < values.length; i++) {
            sensorValues[i] = parseInt(values[i]);
        }

        // Create a JSON object with nested sensor data
        currentReading = {
            timestamp: millis(),
            sensors: {
                sensor0: sensorValues[0],
                sensor1: sensorValues[1],
                sensor2: sensorValues[2]
            }
        };

        // Add this reading to our collection
        allData.push(currentReading);

        // Console log the JSON object
        console.log("JSON reading:", currentReading);
        console.log("Total readings collected:", allData.length);
    });
}

function draw() {
    background(220);

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

    // Display JSON data on screen
    fill(0);
    textAlign(LEFT, TOP);
    textSize(12);
    text("JSON Object:", 10, 10);
    text(`{ timestamp: ${currentReading.timestamp}, sensors: { sensor0: ${currentReading.sensors?.sensor0}, sensor1: ${currentReading.sensors?.sensor1}, sensor2: ${currentReading.sensors?.sensor2} } }`, 10, 25);

    // Display individual sensor values
    textSize(14);
    text(`Sensor 0: ${sensorValues[0]}`, 10, 60);
    text(`Sensor 1: ${sensorValues[1]}`, 10, 80);
    text(`Sensor 2: ${sensorValues[2]}`, 10, 100);

    // Display collection info
    text(`Readings collected: ${allData.length}`, 10, 130);
    text(`Press 's' to save all data`, 10, 150);
}

// Press 's' key to save ALL collected data to a JSON file
function keyPressed() {
    if (key === 's' || key === 'S') {
        saveJSON(allData, 'multi-sensor-data.json');
        console.log(`Saved ${allData.length} readings to file!`);
    }
}
