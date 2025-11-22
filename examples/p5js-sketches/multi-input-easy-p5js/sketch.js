// Serial Bridge Example - P5.js Sketch
// This sketch receives TWO values from Arduino and uses them to control shapes

let bridge;
let sensor1Value = 0;
let sensor2Value = 0;

function setup() {
    createCanvas(400, 400);

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
}

function draw() {
    background(220);

    // Use sensor1 to control the ellipse size
    let ellipseSize = map(sensor1Value, 0, 1023, 20, 200);
    fill(100, 150, 255);
    ellipse(150, height / 2, ellipseSize, ellipseSize);

    // Use sensor2 to control the square size
    let squareSize = map(sensor2Value, 0, 1023, 20, 200);
    fill(255, 150, 100);
    rectMode(CENTER);
    square(250, height / 2, squareSize);

    // Display the values on screen
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text(`Sensor 1: ${sensor1Value}`, 10, 10);
    text(`Sensor 2: ${sensor2Value}`, 10, 30);
    text(`Ellipse size: ${ellipseSize}`, 10, 60);
    text(`Square size: ${squareSize}`, 10, 80);
}
