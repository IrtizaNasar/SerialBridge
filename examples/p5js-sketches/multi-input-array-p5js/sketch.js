// Serial Bridge Example - Multiple Sensors with Arrays
// This sketch receives MULTIPLE values from Arduino

let bridge;
let sensorValues = [0, 0, 0]; // Array to hold all sensor values

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

        // Console log the split values
        console.log("Split values:", values);

        // Loop through and convert all values to numbers
        for (let i = 0; i < values.length; i++) {
            sensorValues[i] = parseInt(values[i]);
        }

        // Console log all sensor values
        console.log("All sensors:", sensorValues);
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

    // Display all values on screen
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    for (let i = 0; i < sensorValues.length; i++) {
        text(`Sensor ${i}: ${sensorValues[i]}`, 10, 10 + (i * 20));
    }
}