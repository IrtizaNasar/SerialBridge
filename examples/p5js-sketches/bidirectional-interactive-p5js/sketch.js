// Serial Bridge Example - P5.js Sketch
// This sketch visualizes data coming from Arduino via the Bridge

let bridge;
let sensorValue = 0;
let dataHistory = [];
let isConnected = false;
let connectionStatus = 'disconnected';

function setup() {
    let canvas = createCanvas(800, 400);
    canvas.parent('canvas-container');

    // Create a new Serial Bridge connection
    bridge = new SerialBridge('http://localhost:3000');

    // Listen for data from arduino_1
    bridge.onData('arduino_1', (data) => {
        console.log('Received data:', data);

        // Try to parse the data as a number
        const value = parseFloat(data.trim());
        if (!isNaN(value)) {
            sensorValue = constrain(value, 0, 1023);

            // Add to history for the line graph
            dataHistory.push(sensorValue);
            if (dataHistory.length > 150) {
                dataHistory.shift();
            }
        }
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
    connectionDisplay();
    // Dark background with gradient
    for (let i = 0; i <= height; i++) {
        let inter = map(i, 0, height, 0, 1);
        let c = lerpColor(color(10, 10, 10), color(20, 20, 30), inter);
        stroke(c);
        line(0, i, width, i);
    }

    // Title
    fill(255);
    noStroke();
    textAlign(CENTER);
    textSize(20);
    text('Arduino Data Visualization', width / 2, 30);



    if (isConnected || dataHistory.length > 0) {
        drawVisualization();
    } else {
        drawWaitingMessage();
    }
}

function connectionDisplay() {
    // Connection status indicator
    let statusColor = isConnected ? color(16, 185, 129) : color(239, 68, 68);
    fill(statusColor);
    circle(width / 2, 55, 12);

    textSize(12);
    fill(150);
    text(connectionStatus.toUpperCase(), width / 2, 75);
}
function drawVisualization() {
    // Bar chart
    push();
    let barWidth = 80;
    let barMaxHeight = 200;
    let barHeight = map(sensorValue, 0, 1023, 0, barMaxHeight);
    let barX = 150;
    let barY = height - 50;

    // Bar background
    fill(30);
    rect(barX, barY - barMaxHeight, barWidth, barMaxHeight);

    // Value bar
    let barColor = lerpColor(color(99, 102, 241), color(239, 68, 68), sensorValue / 1023);
    fill(barColor);
    rect(barX, barY - barHeight, barWidth, barHeight);

    // Bar labels
    fill(255);
    noStroke();
    textAlign(CENTER);
    textSize(14);
    text('Current Value', barX + barWidth / 2, barY + 20);
    textSize(18);
    text(Math.round(sensorValue), barX + barWidth / 2, barY + 40);
    pop();

    // Line graph
    push();
    translate(280, 0);

    // Graph background
    fill(20);
    noStroke();
    rect(20, height - 260, width - 320, 200);

    // Graph border
    noFill();
    stroke(60);
    strokeWeight(1);
    rect(20, height - 260, width - 320, 200);

    // Graph title
    fill(255);
    noStroke();
    textAlign(LEFT);
    textSize(14);
    text('Real-time Graph', 25, height - 270);

    // Draw the line graph
    if (dataHistory.length > 1) {
        noFill();
        stroke(99, 102, 241);
        strokeWeight(2);

        beginShape();
        for (let i = 0; i < dataHistory.length; i++) {
            let x = map(i, 0, dataHistory.length - 1, 30, width - 310);
            let y = map(dataHistory[i], 0, 1023, height - 70, height - 250);
            vertex(x, y);
        }
        endShape();
    }

    // Y-axis labels
    fill(150);
    noStroke();
    textSize(10);
    textAlign(RIGHT);
    text('1023', 15, height - 250);
    text('512', 15, height - 155);
    text('0', 15, height - 65);

    pop();
}

function drawWaitingMessage() {
    fill(150);
    noStroke();
    textAlign(CENTER);
    textSize(16);
    text('Waiting for Arduino data...', width / 2, height / 2 - 20);
    textSize(12);
    text('Make sure Serial Bridge is running and arduino_1 is connected', width / 2, height / 2 + 10);
}

// Optional: Send data to Arduino on key press
function keyPressed() {
    if (bridge && isConnected) {
        if (key === ' ') {
            bridge.send('arduino_1', 'TOGGLE')
                .then(() => console.log('Sent: TOGGLE'))
                .catch(err => console.error('Send failed:', err));
        } else if (key >= '0' && key <= '9') {
            bridge.send('arduino_1', `VALUE:${key}`)
                .then(() => console.log(`Sent: VALUE:${key}`))
                .catch(err => console.error('Send failed:', err));
        }
    }
}
