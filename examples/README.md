# Serial Bridge Examples

This folder contains examples demonstrating how to use the Serial Bridge with P5.js and Arduino.

## 📁 Contents

### `/p5js-sketches/`

**How to use:**

1. Start the Serial Bridge desktop app
2. Add a connection with ID `device_1`
3. Upload one of the Arduino sketches to your board
4. Open `examples/'your p5js example folder'/index.html` in your browser
5. Observe the real-time visualization

#### `/basic-input-p5js/`

A simple P5.js sketch that visualizes data from an Arduino in real-time as a circle on a canvas.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Displays data as a circle

#### `/basic-output-p5js/`

A simple P5.js sketch that sends mouseX data to an Arduino in real-time to control the brightness of an LED.

**Features:**

- Connects to Serial Bridge
- Send data to `device_1`
- Uses mouseX to control LED brightness

#### `/multi-input-easy-p5js/`

A simple P5.js sketch that visualizes two sets of values from an Arduino in real-time.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Splits the data into two values
- Displays one set of data as a circle
- Displays the second set of data as a square

#### `/multi-input-array-p5js/`

A P5.js sketch that visualizes an array values from an Arduino in real-time.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Splits the data into multiple values
- Displays one set of data as a circle
- Displays the second set of data as a square
- Displays the third set of data as a triangle
- Demonstrates how to scale the examples for as many inputs as required.

#### `/store-input-p5js/`

A simple P5.js sketch that visualizes data from an Arduino in real-time as a circle on a canvas. Stores this value in a simple JSON object.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Displays data as a circle
- Stores data into a JSON object
- Svaes JSON file on keypress

#### `/store-multi-input-p5js/`

A P5.js sketch that visualizes multiple data inputs from an Arduino in real-time. Stores these values in a JSON array as multiple objects.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Displays data as a circle
- Stores data into a JSON array as multiple objects
- Saves JSON file on keypress

#### `/bidirectional-interactive-p5js/`

A simple P5.js sketch that visualizes data from an Arduino in real-time and sends data back to control an LED.

**Features:**

- Connects to Serial Bridge
- Receives data from `device_1`
- Displays data as a bar chart and line graph
- Shows connection status indicator

#### `/test-serial-p5js/`

A utility sketch to test if data is being received correctly.

**Features:**

- Connects to Serial Bridge
- Logs all received data to the browser console
- Useful for debugging connection issues

### `/arduino-sketches/`

Example Arduino sketches compatible with the Bridge.

#### `basic-sensor/`

- Reads an analog sensor (A0) and sends values to serial
- Ideal for getting started
- Compatible with potentiometers, light sensors, etc.

#### `basic-send-data/`

- Reads an analog sensor (A0) and sends values to serial
- Ideal for getting started
- Compatible with potentiometers, light sensors, etc.

#### `basic-recieve-data/`

- Recieves data from a p5js sketch over serial
- Uses the data to control analogWrite() values.
- Ideal for getting started
- Compatible with outputs such as LEDs, DC Motors etc

#### `send-multi-data/`

- Reads two analog sensors (A0), (A1) and sends values to serial
- Demonstrates comma separated serial data
- Compatible with potentiometers, light sensors, etc.

#### `send-multi-array-data/`

- Reads three analog sensors (A0), (A1), (A2) and sends values to serial
- Demonstrates how to use comma separated serial data
- Uses an array of sensorPins to demonstrate how to scale the example to as many inputs as you wish.
- Compatible with potentiometers, light sensors, etc.

#### `bidirectional-interactive/`

- Demonstrates bidirectional communication
- Sends sensor data AND receives commands
- Controls LED brightness based on keyboard input from P5.js
- Commands: `TOGGLE` (spacebar) and `VALUE:0-9` (number keys)

#### `ble-uno-r4.ino`
- Bluetooth Low Energy example for Arduino Uno R4 WiFi
- Implements Nordic UART Service (NUS) for serial-over-BLE
- Bidirectional communication supported

#### `ble-nano33.ino`
- Bluetooth Low Energy example for Arduino Nano 33 BLE
- Same NUS implementation as Uno R4
- **Note:** Use `BLE.setLocalName()` to set a unique name for identification

#### `ble-esp32.ino`
- Bluetooth Low Energy example for ESP32 boards
- Implements Nordic UART Service (NUS)
- Compatible with standard ESP32 dev boards

### `/basic-p5js/`

#### `sketch.js`
- Basic data visualization (receive only)

#### `sketch-ble-control.js`
- **Note:** This file is located in the root of `examples/p5js-sketches/` (not in a subfolder)
- Interactive LED control via Bluetooth (send & receive)
- Works with both `ble-uno-r4.ino` and `ble-nano33.ino`
- Press keys 1, 2, Space to control LED

## 🚀 Quick Start

### Step 1: Arduino Setup

```cpp
// Upload basic-sensor.ino to your Arduino
// Ensure baud rate matches (default: 9600)
```

### Step 2: Bridge Setup

1. Open Serial Bridge app
2. Click "New Connection"
3. Set ID to `device_1` (or use default)
4. Select your Arduino's port
5. Click "Connect"

### Step 3: P5.js Setup

```html
<!-- Include these in your HTML head -->
<script src="http://localhost:3000/socket.io/socket.io.js"></script>
<script src="http://localhost:3000/serial-bridge.js"></script>
```

```javascript
// In your sketch.js
let bridge = new SerialBridge(); // Auto-detects URL

bridge.onData("device_1", (data) => {
  console.log("Received:", data);
  // Implement your creative logic here!
});
```

## 📚 Client Library Reference

The `serial-bridge.js` library provides a simple API for communication:

### Basic Usage

```javascript
// Create connection
const bridge = new SerialBridge();

// Listen for data
bridge.onData("device_1", (data) => {
  console.log(data);
});

// Send data to Arduino
// Send data to Arduino
bridge.send("device_1", "TOGGLE");

// Monitor connection status
bridge.onStatus("device_1", (status, port) => {
  console.log(`Status: ${status}, Port: ${port}`);
});
```

### Advanced Features

```javascript
// Listen to ALL Arduinos
bridge.onData("*", (data, id) => {
  console.log(`${id} sent: ${data}`);
});

// Get available ports programmatically
const ports = await bridge.getPorts();

// Connect to a specific serial device
bridge.connectSerial('device_1', '/dev/ttyUSB0');

// Disconnect
await bridge.disconnectSerial("device_1");
```

## 🐻 Creating Custom Examples

1. Duplicate the `basic-input-p5js` folder
2. Modify `sketch.js` to implement your logic
3. Upload an Arduino sketch that sends the required data
4. Connect everything via the Bridge app

## 💡 Best Practices

- **Baud Rate:** Ensure Arduino baud rate (default 9600) matches the Bridge connection.
- **Data Format:** Send simple values (numbers or short strings) for best performance.
- **Update Rate:** Avoid flooding the serial port; a 50-100ms delay in the Arduino loop is recommended.
- **Multiple Arduinos:** Use unique IDs like `device_1`, `arduino_2`, etc.
- **Debugging:** Use the browser console and Bridge app logs to troubleshoot.

## 🐛 Troubleshooting

**Connection failed in P5.js?**

- Verify the Bridge app is running.
- Ensure the server URL is `http://localhost:3000`.
- Check the browser console for errors.

**No data received?**

- Verify Arduino is connected in the Bridge app (green status).
- Check the Arduino Serial Monitor to ensure it is sending data.
- Confirm you are listening to the correct Arduino ID.

**Data appears corrupted?**

- Verify baud rates match (9600).
- Use `Serial.println()` instead of `Serial.print()` to ensure proper line termination.
- Send simple data formats.

## 🎯 Next Steps

- Explore [P5.js Examples](https://p5js.org/examples/)
- Connect multiple Arduinos simultaneously
- Create interactive installations
- Build complex data visualizations
- Experiment with different sensors
