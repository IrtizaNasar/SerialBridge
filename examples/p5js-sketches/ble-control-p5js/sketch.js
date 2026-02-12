// P5.js Example - Controlling Arduino Nano 33 BLE
// This sketch demonstrates bidirectional communication with the Nano 33 BLE

let bridge;
let sensorValue = 0;
let ledState = false;

function setup() {
    let canvas = createCanvas(600, 400);
    canvas.parent('canvas-container'); // Attach to HTML container

    // Connect to Serial Bridge
    bridge = new SerialBridge();

    // Listen for data from the Nano 33 BLE
    // Replace 'device_1' with your actual device ID
    bridge.onData('device_1', (data) => {
        // Check if it's a sensor value (number) or a response message
        if (!isNaN(data)) {
            sensorValue = parseInt(data);
        } else {
            console.log('Response from Arduino:', data);
        }
    });

    // Monitor connection status
    bridge.onStatus('device_1', (status) => {
        console.log('Connection status:', status);
    });
}

function draw() {
    background(30);

    // Display sensor value
    fill(255);
    textSize(16);
    text('Sensor Value: ' + sensorValue, 20, 30);

    // Visualize sensor data as a bar
    fill(100, 200, 255);
    let barHeight = map(sensorValue, 0, 1023, 0, height - 100);
    rect(50, height - barHeight - 50, 80, barHeight);

    // Instructions
    fill(200);
    textSize(14);
    text('Press keys to control LED:', 20, 80);
    text('1 - Turn LED ON', 40, 110);
    text('2 - Turn LED OFF', 40, 130);
    text('SPACE - Toggle LED', 40, 150);
    text('0-9 - Set brightness (0=off, 9=max)', 40, 170);

    // LED state indicator
    fill(ledState ? color(0, 255, 0) : color(100));
    circle(500, 100, 60);
    fill(255);
    text('LED', 485, 105);
}

async function keyPressed() {
    // Send commands to Arduino based on key press

    if (key === '1') {
        await bridge.send('device_1', 'LED_ON');
        ledState = true;
    }
    else if (key === '2') {
        await bridge.send('device_1', 'LED_OFF');
        ledState = false;
    }
    else if (key === ' ') {
        await bridge.send('device_1', 'TOGGLE');
        ledState = !ledState;
    }
    else if (key >= '0' && key <= '9') {
        // Map 0-9 to brightness 0-255
        let brightness = map(parseInt(key), 0, 9, 0, 255);
        await bridge.send('device_1', String(Math.round(brightness)));
        ledState = brightness > 0;
    }
}
