// Serial Bridge Example - Single Sensor with JSON Array
// This sketch collects ALL sensor readings in an array

let bridge;
let sensorValue = 0;
let allData = []; // Array to store all readings

function setup() {
    createCanvas(400, 400);

    // Connect to Serial Bridge
    bridge = new SerialBridge();

    // Listen for data from arduino_1
    bridge.onData('arduino_1', (data) => {
        // Parse the incoming value
        sensorValue = parseInt(data);

        // Create a JSON object for this reading
        let sensorData = {
            value: sensorValue,
            timestamp: millis()
        };

        // Add it to our array of all readings
        allData.push(sensorData);

        // Console log the current reading
        console.log("New reading:", sensorData);
        console.log("Total readings collected:", allData.length);
    });
}

function draw() {
    background(220);

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
    text(`{ value: ${sensorData.value}, timestamp: ${sensorData.timestamp} }`, 10, 30);

    // Display how many readings we've collected
    textAlign(LEFT, TOP);
    textSize(14);
    text(`Readings collected: ${allData.length}`, 10, 60);
    text(`Press 's' to save all data`, 10, 80);
}

// Press 's' key to save ALL collected data to a JSON file
function keyPressed() {
    if (key === 's' || key === 'S') {
        saveJSON(allData, 'all-sensor-data.json');
        console.log(`Saved ${allData.length} readings to file!`);
    }
}