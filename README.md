<p align="center">
  <img width="150" alt="logo" src="assets/docs/logo.png" />
</p>

<h1 align="center">Serial Bridge</h1>

<p align="center"> A desktop application that bridges <b>USB, Bluetooth and RFID/NFC</b> devices to web-based creative coding environments. Connect multiple devices simultaneously, see and plot their data, access it through a simple JavaScript API, or <b>broadcast via OSC</b> to any compatible software.</p>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/licence-Free%20for%20Individuals%20%7C%20Commercial%20for%20Organisations-2E7D32?style=flat&labelColor=1a1a1a" alt="Licence" />
  </a>
</p>

<img width="1412" alt="Serial Bridge Main Interface" src="public/assets/images/main-ui.png" />


<p align="center">
  <a href="https://www.buymeacoffee.com/irti">
    <img src="assets/docs/bmc-button.png" alt="Buy Me A Coffee" width="200" />
  </a>
  <br>
  <b>Support the Project</b>
</p>
<br>

## What's New in V2.0.2

- **RFID / NFC Readers**: Read tag IDs with a USB NFC reader such as the ACR122U, and read or write data on MIFARE Classic tags. See [RFID / NFC Readers](#rfid--nfc-readers).
- **Serial Plotter**: Each connection's Data Preview switches between the Serial Monitor (text) and a live Serial Plotter with zoom. See [Serial Monitor & Plotter](#serial-monitor--plotter).
- **Any Line Ending**: Lines ending in `\n`, `\r\n` or `\r` all work. If a device sends no line endings, the Data Preview still shows its text and explains the fix.
- **Muse S (Athena)**: Every sensor is decoded (EEG, optics, motion, battery) and checked against OpenMuse. Optics now arrive as `type: 'optics'`. See [Muse S (Athena) Support](#muse-s-athena-support).
- **Refreshed Interface**: A calmer, more consistent design and a new app icon.
- **Clearer Help**: Plain-language messages for a busy port, missing permissions on Linux, a baud rate that doesn't match, and the RFID service.
- **Signed & Notarised on macOS**: The app opens without any Terminal steps, and updates arrive automatically.

## What's New in V2.0

- **Bluetooth Low Energy (BLE) Support**: Native support for Arduino Uno R4 WiFi, Nano 33 BLE, and ESP32.
- **Device Profiles**: Built-in support for complex devices like the **Muse 2** and **Muse S (Athena)** EEG headbands, **Bluetooth Heart Rate Monitors** (Whoop, Polar, etc.), and **iPhone (via Sensor Bridge App)** for accessing phone sensors.
- **Session Management**: Save and load your entire workspace configuration.
- **Data Smoothing API**: Built-in `smooth()`, `stable()`, and `kalman()` filters.
- **Improved UI**: Drag-and-drop reordering, editable connection IDs, and real-time connection filtering.
- **Smart Error Handling**: Intelligent detection of connection errors (USB & **Bluetooth**) with clear, actionable troubleshooting steps.
- **OSC Integration**: Bidirectional OSC support. Stream sensor data to **TouchDesigner, Max/MSP, Python**, and control your devices remotely.
- **Dynamic Notch Notifications (macOS Only)**: Native-style notifications with **sound effects** that integrate with your MacBook's notch for connection status updates.

## Table of Contents

- [Features](#features)
- [Why Serial Bridge?](#why-serial-bridge)
- [Installation](#installation)
  - [macOS](#macos-setup)
  - [Windows](#windows-setup)
  - [Linux](#linux-setup)
- [Quick Start](#quick-start)
- [Serial Monitor & Plotter](#serial-monitor--plotter)
- [Bluetooth Setup](#bluetooth-setup)
- [RFID / NFC Readers](#rfid--nfc-readers)
- [Device Profiles](#device-profiles)
  - [Muse 2 Support](#muse-2-support)
  - [Muse S (Athena) Support](#muse-s-athena-support)
  - [Heart Rate Monitor Support](#heart-rate-monitor-support)
  - [iPhone (Sensor Bridge App)](#iphone-sensor-bridge-app)

- [OSC Integration (Broadcasting & Receiving)](#osc-integration-broadcasting--receiving)
- [OSC Data Addressing (Standard vs Flattened)](#osc-data-addressing-standard-vs-flattened)
- [API Reference](#api-reference)
- [Data Smoothing (For Beginners)](#data-smoothing-for-beginners)
- [Session Management](#session-management)
- [Dynamic Notch Notifications (macOS Only)](#dynamic-notch-notifications-macos-only)
- [Examples](#examples)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Privacy & Analytics](#privacy--analytics)
- [License](#license)
- [Contributors](#contributors)
- [Built With](#built-with)
- [Support](#support)

## Features

- **Multiple Device Support**: Connect and manage multiple USB, Bluetooth and RFID devices simultaneously
- **Session Management**: Save and load your connection configurations for quick setup
- **Connection Filtering**: Organize connections by type (USB / Bluetooth / RFID) with live counts
- **Serial Monitor & Plotter**: See incoming data as text or as a live graph, like the Arduino IDE
- **Real-time Data Streaming**: Stream sensor data to your P5.js sketches with low latency
- **Simple API**: Clean, beginner-friendly JavaScript client library
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **WebSocket Communication**: Fast bidirectional communication
- **Bluetooth Support**: Connect via USB Serial or Bluetooth Low Energy (BLE)
- **RFID / NFC**: Read tag IDs and tag data with a USB NFC reader (ACR122U)
- **Device Profiles**: Built-in support for Muse 2, Muse S (Athena), heart rate monitors and the iPhone Sensor Bridge app
- **Editable Connection IDs**: Customize connection identifiers for better project organization
- **Framework Agnostic**: Works with **P5.js, Three.js, React, Vue**, or vanilla HTML/JS
- **OSC Integration**: Bidirectional support for TouchDesigner, Max/MSP, and Python
- **Smart Error Handling**: Clear, actionable feedback for USB and Bluetooth connection issues
- **Dynamic Notch**: Native macOS notifications with sound effects

  ![Serial-Bridge](https://github.com/user-attachments/assets/371df7c8-a4e4-421f-90e5-00276cf921d6)





## Why Serial Bridge?

While the **Web Serial API** is a great tool, **Serial Bridge** offers several distinct advantages for creative coding and installation work:

| Feature                    | Web Serial API                   | Serial Bridge                                                |
| -------------------------- | -------------------------------- | ------------------------------------------------------------ |
| **Browser Support**        | Chrome/Edge only                 | **All Browsers** (Chrome, Firefox, Safari)                   |
| **Connection Persistence** | Disconnects on page refresh      | **Stays Connected** (Refresh page without losing connection) |
| **User Experience**        | Permission prompt on every visit | **Connect Once**, use everywhere                             |
| **Multiple Devices**       | Complex to manage in code        | **Easy** (Manage via UI, access by ID)                       |
| **Security Context**       | Requires HTTPS                   | Works on **localhost** & HTTPS                               |

**Key Advantage:** With Serial Bridge, your P5.js sketch doesn't need complex connection logic. You just listen for data. This makes it perfect for:

- Classrooms and workshops (easier for beginners)
- Permanent installations (more robust reconnection)
- Rapid prototyping (refresh your sketch instantly without reconnecting hardware)

## Installation

### Download Pre-built Application

Download the latest release for your platform from the [Releases page](https://github.com/IrtizaNasar/SerialBridge/releases):

| Platform | File |
| :--- | :--- |
| macOS, Apple Silicon (M1 and later) | `Serial-Bridge-<version>-arm64.dmg` |
| macOS, Intel | `Serial-Bridge-<version>-x64.dmg` |
| Windows | `Serial-Bridge-<version>-x64.exe` |
| Linux | `Serial-Bridge-<version>-x86_64.AppImage` or `Serial-Bridge-<version>-amd64.deb` |

Serial Bridge checks for updates when it opens. When a new version has downloaded, it asks whether to restart now or later.

### macOS Setup

1. Open the `.dmg` and drag **Serial Bridge** into your **Applications** folder.
2. Open it. Serial Bridge is signed and notarised by Apple, so it opens like any other app.
3. The first time you use Bluetooth, macOS asks for permission. Click **Allow**.

RFID readers need no setup on macOS.

### Windows Setup

When you run the installer or executable for the first time, you may see a blue "Windows protected your PC" popup (Microsoft SmartScreen). This happens because the app is not code-signed (which costs hundreds of dollars/year).

1.  Click **"More info"**.
2.  Click **"Run anyway"**.

**Drivers:**
Most modern Windows systems (10/11) automatically install drivers for Arduino/ESP32. If your device doesn't show up:
- Install the **CH340 Driver** (common for clones).
- Install the **CP210x Driver** (common for ESP32).

**RFID Readers (One-Time Setup):**
Windows only starts its Smart Card service on demand, and Serial Bridge needs it running. An administrator needs to do this once per computer:

1. Press **Win + R**, type `services.msc` and press Enter.
2. Double-click **Smart Card**, set **Startup type** to **Automatic**, click **Start**, then **OK**.

Or, in a terminal opened as administrator:
```bat
sc config SCardSvr start= auto
sc start SCardSvr
```
Until then, the reader list says *"RFID needs the Windows Smart Card service set to Automatic and running"*.

### Linux Setup

If you are using the `.deb`, install it with `sudo apt install ./Serial-Bridge-*-amd64.deb` and skip steps 1 and 2. If you are using the `.AppImage` (especially on Ubuntu 22.04+), you may need to perform a few one-time setup steps.

**1. Make Executable**
Right-click the `.AppImage` file -> Properties -> Permissions -> Allow executing file as program.
Or via terminal:
```bash
chmod a+x Serial-Bridge-*.AppImage
```

**2. Install libfuse2 (Ubuntu 22.04+)**
AppImages require FUSE to run.
```bash
sudo apt install libfuse2
```

**3. Serial Port Permissions**
To access USB devices without `sudo`, add your user to the `dialout` group:
```bash
sudo usermod -a -G dialout $USER
```
*Log out and log back in for this to take effect.*

**4. Bluetooth Support**
Ensure your system's Bluetooth service is running. We automatically enable Web Bluetooth, but if you encounter issues, try running the app with the flag:
```bash
./Serial-Bridge-*.AppImage --enable-features=WebBluetooth
```

**5. Sandbox Issues (Ubuntu 24.04+)**
If you see a "SUID sandbox helper binary" error, you can either:

- Run with `--no-sandbox`: `./Serial-Bridge-*.AppImage --no-sandbox`
- OR enable unprivileged user namespaces (recommended fix):
  ```bash
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
  ```

**6. RFID Readers (Optional)**
RFID needs the PC/SC service:
```bash
sudo apt install pcscd libccid
sudo systemctl enable --now pcscd
```
If the reader still isn't listed, Linux's own NFC driver may have claimed it. Turn that driver off, then unplug and replug the reader:
```bash
echo "blacklist pn533_usb" | sudo tee /etc/modprobe.d/blacklist-pn533.conf
sudo modprobe -r pn533_usb
```

### Build from Source - For Advanced Users

```bash
# Clone the repository
git clone https://github.com/IrtizaNasar/SerialBridge.git
cd SerialBridge

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build
```

## Quick Start

### 1. Connect Your Device

1. Launch the Serial Bridge application
2. Click **"New Connection"** to add a device
3. Choose your connection type:
   - **USB**: For devices connected via USB cable (automatically loads available ports)
   - **Bluetooth**: For Bluetooth Low Energy (BLE) devices
   - **RFID (NFC)**: For USB NFC readers (see [RFID / NFC Readers](#rfid--nfc-readers))
4. For USB connections:
   - Select your device's port from the dropdown (ports load automatically)
   - Choose the baud rate (default: 9600)
   - Click **"Connect"**
5. For Bluetooth connections:
   - Click **"Scan"** to find nearby BLE devices
   - Select your device from the list
   - Click **"Connect"**

> [!TIP]
> **Identifying Your Board (Windows)**: On Windows, boards often appear as generic "USB Serial Device". The port list shows the Vendor ID (VID) and Product ID (PID) to help you identify them (e.g., `2341:0043`).
>
> - `2341` is the code for **Arduino SA**.
> - `0043` is the code for an **Arduino Uno**.

> [!TIP]
> **Organizing Connections**: Use the sidebar filters to view connections by type. Click "All Connections" to expand and see the USB, Bluetooth and RFID counts.

Once connected, the card's **Data Preview** shows each message as it arrives. Switch it to the plotter to see the numbers as a graph: see [Serial Monitor & Plotter](#serial-monitor--plotter).

> [!NOTE]
> **Connection IDs**: Each new connection gets the next free ID (`device_1`, `device_2`, …), shown on its card. Your sketch uses this ID to choose which device to listen to. You can rename it by clicking the ID on the card (while disconnected); use the same name in your sketch. IDs are case-sensitive.

### 2. Upload Arduino Sketch

Upload this basic sketch to your Arduino:

```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  Serial.println(sensorValue);
  delay(50);
}
```

### 3. Create Your P5.js Project

> [!TIP]
> **Quick Setup**: Use the [p5.js Project Generator](https://marketplace.visualstudio.com/items?itemName=Irti.p5js-project-generator) VS Code extension to instantly generate a P5.js 2.0 project structure.

> [!NOTE]
> **Language Note**: While the examples below use **P5.js** for simplicity, the Serial Bridge client library is **vanilla JavaScript** and works with **any** web framework (React, Vue, Three.js, plain HTML/JS, etc.). Unless otherwise specified (e.g., "Python Integration"), code snippets use JavaScript.

Include the client library in your HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/p5@2.1.1/lib/p5.min.js"></script>
    <script src="http://localhost:3000/socket.io/socket.io.js"></script>
    <!-- Serial Bridge client library, served by the app (no need to download it) -->
    <script src="http://localhost:3000/serial-bridge.js"></script>
    <script src="sketch.js"></script>
  </head>
  <body></body>
</html>
```

> [!IMPORTANT]
> The `serial-bridge.js` script is served **dynamically** by the Serial Bridge application. **You do NOT need to download or copy this file.** Just ensure the app is running and the port matches.

**Note:** The Socket.IO URL should match your bridge server port (default: 3000). The active server URL is displayed in the Serial Bridge application sidebar under "Server URL".

<img width="275" alt="image" src="assets/docs/server-url.png" />


> [!TIP]
> **Quick Setup**: Click **"Usage Guide"** in the app sidebar to see the exact code snippets with the correct port number automatically filled in. You can copy them directly to your project.

Create your sketch:

```javascript
let bridge;
let sensorValue = 0;

function setup() {
  createCanvas(400, 400);

  // Connect to Serial Bridge
  bridge = new SerialBridge(); // Auto-detects URL from socket.io script
  // OR: bridge = new SerialBridge('http://localhost:3000');

  // Listen for data from device_1
  bridge.onData('device_1', (data) => {

    sensorValue = parseInt(data);
  });
}

function draw() {
  background(220);

  // Visualize the sensor data
  let h = map(sensorValue, 0, 1023, 0, height);
  rect(width / 2 - 25, height - h, 50, h);

  text(`Value: ${sensorValue}`, 10, 20);
}
```

![Screen Recording 2025-11-20 at 00 35 31](https://github.com/user-attachments/assets/963fad9d-8d0d-466d-8596-6bce072cb072)

## Serial Monitor & Plotter

Every connection card has a **Data Preview** with two views, switched with the two icons in its header:

- **Serial Monitor** (the default) shows each message as text, newest at the bottom, like the Arduino IDE's Serial Monitor. It keeps the last 50 messages.
- **Serial Plotter** draws the numbers in each message as a live graph of the last 20 seconds, like the Arduino IDE's Serial Plotter.

The plotter reads the formats Arduino sketches usually print:

| Your sketch prints | Plotted as |
| :--- | :--- |
| `512` | one value |
| `512,300,87` (or separated by spaces or tabs) | three values |
| `x:12 y:-4` or `temp=21.5` | named values |
| `{"x": 12, "y": -4}` | named values |

Each value gets its own lane and its own scale, so a 0–1023 sensor and a 0–1 sensor are both easy to read. The plotter shows up to 8 values; if a message has more, the footer says how many it is showing. If a value goes missing for a moment, the gap is drawn as a dashed line (**No data**). The plotter icon is only available when the data contains numbers.

**Zoom** to see small changes:
- Click **Zoom in**, then click the part of a line you want to see, or drag over a range.
- Or scroll (or pinch, or ⌘/Ctrl + scroll) over the graph.
- Click **Zoom out**, or double-click the graph, to see everything again.

The **pause** button freezes both views. Press it again to carry on.

> [!NOTE]
> **Line endings**: A message ends when the line ends, with `\n`, `\r\n` or `\r`, so `Serial.println()` always works. Text that arrives without a line ending still appears in the Serial Monitor, and after a couple of seconds a notice explains the fix, but p5.js, OSC and the plotter only receive complete lines. On Arduino, end each message with `Serial.println()`.

## Bluetooth Setup

There are two ways to use Bluetooth with Serial Bridge, depending on your hardware:

**1. Classic Bluetooth (HC-05, HC-06, ESP32 Classic)**
*   **Hardware:** Arduino Uno/Mega with HC-05 module, or ESP32 in Classic mode.
*   **How it works:** The operating system creates a virtual Serial Port (COM port) for the device.
*   **In Serial Bridge:** Treat this exactly like a USB connection.
    1.  Pair the device in your computer's Bluetooth settings.
    2.  In Serial Bridge, click **"+ New Connection"**.
    3.  Select **Type: USB / Serial** (NOT Bluetooth).
    4.  Select the device's port from the list.

**2. Bluetooth Low Energy (BLE) - Arduino Uno R4 WiFi / Nano 33 BLE**
*   **Hardware:** Newer boards with built-in BLE.
*   **How it works:** Direct communication without a COM port.
*   **In Serial Bridge:** Use the dedicated Bluetooth mode.
    1.  Upload a BLE example sketch (e.g., `ble-uno-r4.ino`).
    2.  In Serial Bridge, click **"+ New Connection"**.
    3.  Select **Type: Bluetooth**.
    4.  Click **"Scan"**, select your device, and click **"Connect"**.

## RFID / NFC Readers

Serial Bridge reads NFC tags (cards, key fobs, stickers) with a USB reader that uses the standard PC/SC interface. It is tested with the **ACS ACR122U**.

**Setup:** none on macOS. On Windows, set the Smart Card service to start automatically (see [Windows Setup](#windows-setup)). On Linux, install `pcscd` (see [Linux Setup](#linux-setup)).

### Connecting a Reader

1. Plug in the reader.
2. Click **"New Connection"** and choose **RFID (NFC)**.
3. Select the reader (click **"Refresh"** if you plugged it in just now) and click **"Connect"**.
4. Hold a tag on the reader. The card shows the tag's ID (UID) and type, and the ID appears in the Data Preview.

Reading tag IDs works with any NFC tag.

### Reading and Writing Tag Data

With a tag on the reader, the card shows **Block #**, **Auth Key** and **Write Data** fields. These are designed for **MIFARE Classic** tags, the most common RFID cards and key fobs:

- **Read** reads the 16 bytes in that block. The result appears in the Data Preview.
- **Write** writes your text to that block: up to 16 characters, padded with zeros.
- **Format** clears every data block on a MIFARE Classic 1K tag.

MIFARE Classic tags need a key to read or write. New tags use `FFFFFFFFFFFF`, which is the default. Block 4, the default block, is a safe place for your own data.

> [!WARNING]
> Some blocks hold a tag's ID, keys or lock bits, and writing to them can lock the tag for good. Serial Bridge refuses to write to them: block 0 and every sector trailer (blocks 3, 7, 11, …) on MIFARE Classic, and pages 0–3 on NTAG / Ultralight tags. **Format** skips them too.

### Using Tags in p5.js

The simplest way: a tag's ID arrives like any other data.

```javascript
bridge.onData('device_1', (data) => {
  console.log('Tag:', data);   // e.g. "04A2B3C4D5E680"
});
```

For the tag type, and to know when a tag is taken away:

```javascript
bridge.onTagDetected('device_1', (tag) => {
  console.log(tag.uid, tag.type);   // e.g. "04A2B3C4D5E680", "NTAG_213"
});

bridge.onTagRemoved('device_1', () => {
  console.log('Tag removed');
});
```

Read and write tag data from your sketch while a tag is on the reader:

```javascript
// Read block 4: returns { block, hex, text, raw }
const result = await bridge.rfidRead('device_1', { block: 4 });
console.log(result.text);

// Write up to 16 characters to block 4
await bridge.rfidWrite('device_1', { block: 4, data: 'hello' });
```

> [!NOTE]
> After each read, `onData` also receives the result as a JSON string. If your sketch uses `onData` for tag IDs, ignore messages that start with `{`.

Over OSC, each tag ID is sent as `/serial` with `[device_1, UID]`.

## OSC Integration (Broadcasting & Receiving)

Serial Bridge can broadcast your sensor data to other applications in real-time using **OSC (Open Sound Control)** or **Socket.IO**. This allows you to monitor data in the Serial Bridge app while simultaneously processing it in Python, TouchDesigner, Max/MSP, or any other software that supports OSC.

### 1. Python Integration (Recommended)
You can read data in Python using the `python-socketio` library. This works on Windows, macOS, and Linux.

**Installation:**
```bash
pip install "python-socketio[client]"
```

**Basic Example (Reading Data by Device ID):**
```python
import socketio

# Create a Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print("Connected to Serial Bridge!")

# This function runs whenever data is received from ANY device
@sio.on('serial-data')
def on_message(data):
    # 'data' is a dictionary with two keys:
    # 1. 'id': The Device ID you assigned in the app (e.g., 'device_1', 'arduino_A')
    # 2. 'data': The actual value sent by the device
    
    device_id = data['id']
    value = data['data']
    
    # Example: Filter by Device ID
    if device_id == 'device_1':
        print(f"Received from Device 1: {value}")
        
    elif device_id == 'arduino_A':
        print(f"Received from Arduino A: {value}")
        
    # Print everything
    # print(f"[{device_id}] {value}")

# Connect to the Serial Bridge app (default port 3000)
try:
    sio.connect('http://localhost:3000')
    sio.wait() # Keep the script running
except Exception as e:
    print(f"Connection failed: {e}")
```

### 2. OSC Broadcasting (Sending Data)

Stream sensor data from Serial Bridge to other apps (TouchDesigner, Max/MSP, etc.).

**Status Indicator:**
The small green dot next to "OSC Settings" in the sidebar indicates that **either** Broadcasting OR Receiving is active.

**How to Enable:**
1. Click **"OSC Settings"** in the sidebar footer.
2. Toggle **"Enable OSC Broadcasting"** to ON.
3. (Optional) Configure the Target IP and Port (Default: `127.0.0.1` : `3333`).

**Protocol:**
- **Address:** `/serial`
- **Arguments:** `[DeviceID, Data]`

**TouchDesigner Setup:**

> [!TIP]
> **Drag-and-Drop Component Available!** Download [`SerialBridge_TD.tox`](examples/touchdesigner/SerialBridge_TD.tox), drag it into TouchDesigner, and you're done. Supports multiple devices simultaneously with automatic channel creation. See [`examples/touchdesigner/`](examples/touchdesigner/) for full documentation.

1. Download [`SerialBridge_TD.tox`](examples/touchdesigner/SerialBridge_TD.tox)
2. Drag into your TouchDesigner project
3. All sensor data appears as CHOP channels automatically with device ID prefixes:
   - `device_1_bpm`, `device_1_rr_0` (Heart Rate Monitor)
   - `device_2_value` (Arduino/simple sensors)
   - `device_3_eeg_tp9`, `device_3_ppg_ch1` (Muse 2)
   - And more for all supported device profiles
4. See [full documentation](examples/touchdesigner/) for channel filtering and multi-device support

**Python via OSC:**
If you prefer OSC over Socket.IO (e.g., for lower latency on local networks):
```bash
pip install python-osc
```
**Python Code:**
```python
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import BlockingOSCUDPServer
import json

def handle_data(address, *args):
    # OSC Message format: /serial <device_id> <data>
    device_id = args[0]
    raw_data = args[1]
    
    print(f"[{device_id}] {raw_data}")

dispatcher = Dispatcher()
dispatcher.map("/serial", handle_data)

server = BlockingOSCUDPServer(("127.0.0.1", 3333), dispatcher)
print("Listening on port 3333...")
server.serve_forever()
```

> **Note for Windows Users:** Python is not included with Serial Bridge. You must install Python separately from [python.org](https://www.python.org/) to run these scripts. The Serial Bridge app itself runs independently and does not require Python.

### 3. OSC Receiving (Controlling Devices)

Control your Arduino or other devices by sending OSC messages TO Serial Bridge.

**How to Enable:**
1. Click **"OSC Settings"** in the sidebar footer.
2. Toggle **"Enable OSC Receiving"** to ON.
3. (Optional) Configure the Listen Port (Default: `3334`).

**Protocol:**
- **Address:** `/send`
- **Arguments:** `[DeviceID, Message]`

> [!NOTE]
> **For p5.js Users:** OSC Receiving is designed for external applications (TouchDesigner, Max/MSP, Python) to control your Arduino. If you want to send data from p5.js to Arduino, use the [Serial Bridge JavaScript API](#sendid-data) instead with `bridge.send('device_1', 'LED_ON')`.

**Example: Python Controller**
```python
from pythonosc.udp_client import SimpleUDPClient

ip = "127.0.0.1"
port = 3334 # Note: Different from the broadcast port (3333)

client = SimpleUDPClient(ip, port)

# Send "LED_ON" to device_1
client.send_message("/send", ["device_1", "LED_ON"])
print("Sent LED_ON to device_1")
```

**Example: Arduino Sketch**
```cpp
void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Remove whitespace

    if (command == "LED_ON") {
      digitalWrite(LED_BUILTIN, HIGH);
    } else if (command == "LED_OFF") {
      digitalWrite(LED_BUILTIN, LOW);
    }
  }
}
```

## OSC Data Addressing (Standard vs Flattened)

Serial Bridge includes a **"Flatten Data"** toggle to make mapping easier in software like Ableton Live, TouchDesigner, and Max/MSP.

### 1. Standard Mode (Default)
**Best for:** Python, JavaScript, custom scripts.
*   **Format:** One message per device update.
*   **Address:** `/serial`
*   **Arguments:** `[deviceID, JSON_String]`
*   **Example:** `/serial` ` ["device_1", "{\"bpm\": 75}"]`

### 2. Flattened Mode ("Explode Data")
**Best for:** TouchDesigner, Ableton Live (Connection Kit), OSCulator.
*   **How to Enable:** Go to **OSC Settings** -> Toggle **"Explode / Flatten Data"**.
*   **Format:** Individual messages for every single data point.
*   **Address Pattern:** `/serial/<device_id>/<data_path>`

#### Addressing Examples

| Device | Data Point | Flattened Address | Value Type |
| :--- | :--- | :--- | :--- |
| **Heart Rate** | BPM | `/serial/device_1/heart_rate/bpm` | Float |
| **Muse 2/S** | EEG (TP9) | `/serial/device_1/eeg/tp9` | Float |
| **Muse 2/S** | Accel X | `/serial/device_1/accel/x` | Float |
| **iPhone** | Pitch | `/serial/device_1/orientation/pitch` | Float |
| **Arduino** | Value | `/serial/device_1/value` | Float |

> [!TIP]
> **TouchDesigner Users:** Use an **OSC In CHOP**. The channels will automatically appear as `serial_device_1_heart_rate_bpm` etc. Use a **Select CHOP** with pattern `*bpm` to filter.

> [!TIP]
> **Ableton Live Users:** Use the **Connection Kit (OSC)**. Map a parameter to `/serial/device_1/heart_rate/bpm` to control effects with your heartbeat!


### Common Address Reference

If **"Flatten Data"** is enabled, use these exact address patterns in your target software (TouchDesigner, Ableton, Max).

#### **Muse 2 / Muse S (Athena)**
Base Address: `/serial/<device_id>/...`

| Metric | Sub-Path | Complete Example Address | Type |
| :--- | :--- | :--- | :--- |
| **EEG** | `eeg/tp9` | `/serial/device_1/eeg/tp9` | Float (uV) |
| | `eeg/af7` | `/serial/device_1/eeg/af7` | Float (uV) |
| | `eeg/af8` | `/serial/device_1/eeg/af8` | Float (uV) |
| | `eeg/tp10` | `/serial/device_1/eeg/tp10` | Float (uV) |
| **PPG** (Muse 2) | `ppg/ch1` | `/serial/device_1/ppg/ch1` | Int (Raw) |
| | `ppg/ch2` | `/serial/device_1/ppg/ch2` | Int (Raw) |
| **Battery** (Muse S Athena) | `battery/percent` | `/serial/device_1/battery/percent` | Float (%) |
| **Optics** (Muse S Athena) | `optics/li_nir` | `/serial/device_1/optics/li_nir` | Float |
| | `optics/ri_nir` | `/serial/device_1/optics/ri_nir` | Float |
| | `optics/li_ir` | `/serial/device_1/optics/li_ir` | Float |
| | `optics/ri_ir` | `/serial/device_1/optics/ri_ir` | Float |
| **Motion** | `imu/accel/x`| `/serial/device_1/imu/accel/x` | Float (G) |
| | `imu/gyro/x` | `/serial/device_1/imu/gyro/x` | Float (deg/s) |


#### **Heart Rate Monitor**
Base Address: `/serial/<device_id>/...`

| Metric | Sub-Path | Complete Example Address | Type |
| :--- | :--- | :--- | :--- |
| **BPM** | `heart_rate/bpm` | `/serial/device_1/heart_rate/bpm` | Int |
| **RR Interval**| `heart_rate/rr` | `/serial/device_1/heart_rate/rr` | Int (ms) |



#### **iPhone (Sensor Bridge App)**
Base Address: `/serial/<device_id>/...`

| Metric | Sub-Path | Complete Example Address | Type |
| :--- | :--- | :--- | :--- |
| **Acceleration**| `accel_x` | `/serial/device_1/accel_x` | Float (G) |
| | `accel_y` | `/serial/device_1/accel_y` | Float (G) |
| | `accel_z` | `/serial/device_1/accel_z` | Float (G) |
| **Gyroscope** | `gyro_x` | `/serial/device_1/gyro_x` | Float (rad/s) |
| | `gyro_y` | `/serial/device_1/gyro_y` | Float (rad/s) |
| | `gyro_z` | `/serial/device_1/gyro_z` | Float (rad/s) |
| **Orientation***| `orientation_pitch`| `/serial/device_1/orientation_pitch`| Float |
| **Other** | `<json_key>` | `/serial/device_1/<json_key>` | Dynamic |

*> Note: Metric availability depends on the Sensor Bridge app configuration. All JSON keys sent by the app are automatically available as addresses.*


#### **Arduino**

Base Address: `/serial/<device_id>/...`

| Metric | Sub-Path | Complete Example Address | Type |
| :--- | :--- | :--- | :--- |
| **Single Value** | `value` | `/serial/device_1/value` | Float |

## Device Profiles


Serial Bridge includes built-in profiles for specific hardware devices. These profiles automatically handle connection protocols, data parsing, and formatting, making it effortless to work with complex sensors.

> [!NOTE]
> **OSC vs. WebSockets:** The code examples below typically use WebSockets (Socket.IO), which **always** receive the full JSON object. If you are using OSC (e.g. for Ableton/TouchDesigner), enabling **"Flatten Data"** will change the address structure. See the [OSC Data Addressing](#osc-data-addressing-standard-vs-flattened) section for details.

### Muse 2 Support

The application features robust support for the **Muse 2** EEG headband. When connected via Bluetooth using the Muse profile, the bridge automatically decodes the raw data stream and provides structured access to:

- **EEG Data**: Raw microvolt values for all 4 channels (TP9, AF7, AF8, TP10).
- **PPG Data**: Photoplethysmography data from the optical heart rate sensor (3 channels: Ambient, IR, Red).
- **Accelerometer**: 3-axis movement data (X, Y, Z).
- **Gyroscope**: 3-axis rotation data (X, Y, Z).

This allows researchers and developers to build biofeedback applications without worrying about low-level Bluetooth communication or packet decoding.

#### How to Connect

1. Put your Muse 2 headband into pairing mode (lights oscillating).
2. In Serial Bridge, click **"+ New Connection"**.
3. Select **Bluetooth**.
4. **Important**: In the Device Profile dropdown, select **"Muse 2 Headset"**.
5. Click **"Scan"**, select your Muse device from the list, and click **"Connect"**.

#### Accessing Data

When using the Muse profile, data is streamed as JSON objects. You may need to parse the data if it arrives as a string.

**JavaScript**
```javascript
// Connect to Serial Bridge
bridge = new SerialBridge(); // Auto-detects URL from socket.io script

// Listen for data from device_1
bridge.onData("device_1", (data) => {
    // Parse if string, otherwise use directly
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;

    if (parsed.type === 'eeg') {
        // Raw EEG values (microvolts)
        console.log("EEG:", parsed.data.tp9, parsed.data.af7, parsed.data.af8, parsed.data.tp10);
    } else if (parsed.type === 'ppg') {
        // PPG sensor values
        console.log("PPG:", parsed.data.ch1, parsed.data.ch2, parsed.data.ch3);
    } else if (parsed.type === 'imu') {
        // Movement data (Accelerometer & Gyroscope)
        if (parsed.data.accel) {
             console.log("Accel:", parsed.data.accel.x, parsed.data.accel.y, parsed.data.accel.z);
        }
        if (parsed.data.gyro) {
             console.log("Gyro:", parsed.data.gyro.x, parsed.data.gyro.y, parsed.data.gyro.z);
        }
    }
});
```

#### Python Integration 

```python
import socketio

sio = socketio.Client()

@sio.on('serial-data')
def on_message(data):
    device_id = data['id']
    payload = data['data']
    
    # Parse JSON if needed
    import json
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except:
            return
    
    # Ensure this is a dictionary (JSON object)
    if isinstance(payload, dict):
        
        # 1. EEG Data (type: 'eeg')
        if payload.get('type') == 'eeg':
            eeg = payload['data']
            print(f"[{device_id}] EEG: TP9={eeg['tp9']}, AF7={eeg['af7']}, AF8={eeg['af8']}, TP10={eeg['tp10']}")
            
        # 2. PPG / Heart Rate (type: 'ppg')
        elif payload.get('type') == 'ppg':
            ppg = payload['data']
            print(f"[{device_id}] PPG: {ppg['ch1']}, {ppg['ch2']}, {ppg['ch3']}")
            
        # 3. IMU (type: 'imu') - Contains Accel & Gyro
        elif payload.get('type') == 'imu':
            imu = payload['data']
            if 'accel' in imu:
                acc = imu['accel']
                print(f"[{device_id}] Accel: X={acc['x']}, Y={acc['y']}, Z={acc['z']}")
            if 'gyro' in imu:
                gyro = imu['gyro']
                print(f"[{device_id}] Gyro: X={gyro['x']}, Y={gyro['y']}, Z={gyro['z']}")

try:
    sio.connect('http://localhost:3000')
    sio.wait()
except Exception as e:
    print(f"Connection failed: {e}")
```

### Muse S (Athena) Support

**Serial Bridge** reads every sensor on the **Muse S (Athena)** headband:

-   **EEG**: 4 channels (TP9, AF7, AF8, TP10) at the full 256 readings a second.
-   **Optics (fNIRS / pulse)**: the infrared light sensors on the forehead, at 64 readings a second.
-   **Motion**: accelerometer and gyroscope, at 52 readings a second.

#### Technical Specifications

| Feature | Specification |
| :--- | :--- |
| **Wireless** | BLE 5.3 (2.4 GHz) |
| **EEG** | 4 channels (TP9, AF7, AF8, TP10), 256 Hz, 14-bit |
| **Optics** | Left and right forehead sensors, 64 Hz, 20-bit |
| **Wavelengths** | IR (850 nm), Near-IR (730 nm), Red (660 nm) |
| **Accelerometer** | 3-axis, 52 Hz, 16-bit |
| **Gyroscope** | 3-axis, 52 Hz, 16-bit |

#### Units

| Stream | Unit | How it is scaled |
| :--- | :--- | :--- |
| **EEG** | microvolts, centred on zero | 14-bit count × 1450/16383, minus 725 |
| **Optics** | light intensity (no unit) | 20-bit count ÷ 32768, so 0 to 32 |
| **Accelerometer** | g | count × 0.000061 (about 1/16384) |
| **Gyroscope** | degrees per second | count × -0.0074768 |

#### How to Connect

1.  Put your Muse S headband into pairing mode (lights oscillating).
2.  In Serial Bridge, click **"+ New Connection"**.
3.  Select **Bluetooth**.
4.  **Important**: In the Device Profile dropdown, select **"Muse S (Athena)"**.
5.  Click **"Scan"**, select your Muse device, and click **"Connect"**.

#### What You Receive

The headband sends its sensors in small batches. Serial Bridge passes each batch on as its own message, and every message of a kind has the same shape:

```javascript
// about 64 a second
{ type: 'eeg',    data: { tp9, af7, af8, tp10 },           samples: [ ... ] }

// about 21 a second
{ type: 'optics', data: { li_nir, ri_nir, li_ir, ri_ir },  samples: [ ... ] }

// about 17 a second
{ type: 'imu',    data: { accel: {x, y, z}, gyro: {x, y, z} }, samples: [ ... ] }

// about once a second
{ type: 'battery', data: { percent } }
```

Every message also carries:

| Field | Meaning |
| :--- | :--- |
| `timestamp` | When it arrived, in milliseconds |
| `index` | The headband's packet counter, 0 to 255, then it wraps |
| `sequence` | That sensor's own batch counter, 0 to 255, then it wraps. If it jumps by more than one, a batch was lost over Bluetooth |

There are two ways to read a message:

-   **`data`** is the average of the readings in that batch. It is steady and easy to use: draw it, map it to a colour, feed it to a simple sketch. Start here.
-   **`samples[0].rawSamples`** holds every individual reading in the batch, in time order. Use it when you need the full rate, for example to filter EEG into brain-wave bands.

| Message | `rawSamples` contains | Full rate |
| :--- | :--- | :--- |
| `eeg` | `{ tp9: [4 values], af7: [4], af8: [4], tp10: [4] }` | 256 Hz |
| `optics` | `{ li_nir: [3 values], ri_nir: [3], li_ir: [3], ri_ir: [3] }` | 64 Hz |
| `imu` | `{ accel: [{x,y,z} × 3], gyro: [{x,y,z} × 3] }` | 52 Hz |

`battery` messages have no `samples`.

If Serial Bridge ever sends `{ type: 'diagnostic', reason, packets: [hex] }`, the headband sent something the profile does not understand (a firmware change). Nothing else is affected; please report the message so the profile can be updated.

**Optics channel names.** `l` / `r` is the left or right side of the forehead, and `i` means the inner sensor of the pair. `nir` and `ir` are the two infrared wavelengths: the manufacturer lists Near-IR as 730 nm and IR as 850 nm.

> **A note for research use.** The EEG, optics and motion values are checked against [OpenMuse](https://github.com/DominiqueMakowski/OpenMuse)'s decoder on recordings from real headbands and match exactly. Which optics channel is which wavelength follows OpenMuse's labelling, which its authors have not finished validating, and another project ([amused-py](https://github.com/Amused-EEG/amused-py)) labels the two the other way round. Check the assignment yourself before publishing blood-oxygenation figures.

> **Changed from earlier versions.** Optics used to arrive as `type: 'ppg'` with `ch1`…`ch4`, sometimes tucked inside an `eeg` message as `parsed.ppg`, and motion was sometimes inside `parsed.imu`. They now always arrive as their own `optics` and `imu` messages with the names above. EEG messages are read the same way as before. Earlier versions also dropped most readings; all of them now arrive.

#### 1. Quick Start (Log All Data)

```javascript
const bridge = new SerialBridge();

bridge.onData("device_1", (data) => {
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;

    if (parsed.type === 'eeg') {
        // Brain signals, microvolts
        console.log("EEG:", parsed.data.tp9, parsed.data.af7, parsed.data.af8, parsed.data.tp10);
    } else if (parsed.type === 'optics') {
        // Light sensors (fNIRS / pulse)
        console.log("Optics:", parsed.data.li_nir, parsed.data.ri_nir, parsed.data.li_ir, parsed.data.ri_ir);
    } else if (parsed.type === 'imu') {
        // Head movement
        console.log("Accel:", parsed.data.accel.x, parsed.data.accel.y, parsed.data.accel.z);
        console.log("Gyro:", parsed.data.gyro.x, parsed.data.gyro.y, parsed.data.gyro.z);
    } else if (parsed.type === 'battery') {
        console.log("Battery:", parsed.data.percent.toFixed(0) + "%");
    }
});
```

#### 2. Calibration Logic (Essential)

Different data types need different calibration math.

**A. Optics / fNIRS (Ratio Method)**
Used for light intensity. We want "relative change" (e.g. 105% of baseline).
*   **Math**: `Current Value / Baseline Average`
*   **Result**: 1.0 = neutral, above 1.0 = more light reaching the sensor

**B. EEG Asymmetry / Scores (Offset Method)**
Used for indices and scores such as Alpha Asymmetry. We want to zero-centre the data.
*   **Math**: `Current Score - Baseline Average`
*   **Result**: 0.0 = neutral, positive or negative either side

**JavaScript:**
```javascript
let calibrationBuffer = [];
let baseline = null;

// Mode: 'ratio' for optics, 'offset' for EEG scores
function calibrate(val, mode = 'ratio') {
    // 1. Collect the first 200 values
    if (calibrationBuffer.length < 200) {
        calibrationBuffer.push(val);
        return 0; // Still calibrating
    }

    // 2. Work out the average, once
    if (baseline === null) {
        let sum = calibrationBuffer.reduce((a, b) => a + b, 0);
        baseline = sum / calibrationBuffer.length;
        console.log("Baseline established:", baseline);
    }

    // 3. Apply it
    return mode === 'ratio' ? val / baseline : val - baseline;
}
```

Optics messages arrive about 21 times a second, so 200 values is roughly ten seconds of sitting still.

**Python:**
```python
calibration_buffer = []
baseline = None

def calibrate(val, mode='ratio'):
    global baseline

    # 1. Collect the first 200 values
    if len(calibration_buffer) < 200:
        calibration_buffer.append(val)
        return 0.0  # Still calibrating

    # 2. Work out the average, once
    if baseline is None:
        baseline = sum(calibration_buffer) / len(calibration_buffer)
        print(f"Baseline established: {baseline}")

    # 3. Apply it
    return val / baseline if mode == 'ratio' else val - baseline
```

#### 3. JavaScript: Optics Activity with Calibration

```javascript
const bridge = new SerialBridge();

// calibrate() is the function from section 2

bridge.onData("device_1", (data) => {
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;

    if (parsed.type === 'optics') {
        // Left inner sensor, IR wavelength, relative to your resting baseline
        let activity = calibrate(parsed.data.li_ir, 'ratio');
        console.log(`Optics activity: ${activity.toFixed(4)}`);
    }
});
```

#### 4. JavaScript: Every Reading at Full Rate

Use this when you need each individual reading, for example to filter EEG or to draw a waveform.

```javascript
const bridge = new SerialBridge();

bridge.onData("device_1", (data) => {
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed.samples) return;

    let raw = parsed.samples[0].rawSamples;

    if (parsed.type === 'eeg') {
        // 4 readings per channel, 256 a second overall
        raw.af7.forEach(microvolts => {
            // myWaveform.push(microvolts);
        });
    } else if (parsed.type === 'optics') {
        // 3 readings per channel, 64 a second overall
        raw.li_ir.forEach(intensity => {
            // myOptics.push(intensity);
        });
    } else if (parsed.type === 'imu') {
        // 3 readings, 52 a second overall
        raw.accel.forEach(a => {
            // console.log(a.x, a.y, a.z);
        });
    }
});
```

Readings inside one message are evenly spaced at the sensor's rate. Messages arrive in bursts over Bluetooth, so space the readings by the rate (1/256 s for EEG) rather than by when each message arrived.

#### 5. Python: All Streams

```python
import socketio
import json

sio = socketio.Client()

@sio.on('serial-data')
def on_message(message):
    # message is {'id': 'device_1', 'data': '...'}
    payload = message['data']
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            return

    kind = payload.get('type')

    if kind == 'eeg':
        # Averages for this batch
        eeg = payload['data']
        print(f"EEG: {eeg['tp9']:.1f} {eeg['af7']:.1f} {eeg['af8']:.1f} {eeg['tp10']:.1f}")
        # Every reading (256 Hz): 4 values per channel
        raw = payload['samples'][0]['rawSamples']
        # for value in raw['af7']: process(value)

    elif kind == 'optics':
        optics = payload['data']
        print(f"Optics: {optics['li_nir']:.4f} {optics['ri_nir']:.4f} {optics['li_ir']:.4f} {optics['ri_ir']:.4f}")
        # Every reading (64 Hz): payload['samples'][0]['rawSamples']['li_ir']

    elif kind == 'imu':
        imu = payload['data']
        print(f"Accel: {imu['accel']['x']:.2f} {imu['accel']['y']:.2f} {imu['accel']['z']:.2f}")

    elif kind == 'battery':
        print(f"Battery: {payload['data']['percent']:.0f}%")

@sio.event
def connect():
    print("Connected to Serial Bridge!")

@sio.event
def disconnect():
    print("Disconnected")

if __name__ == '__main__':
    try:
        sio.connect('http://localhost:3000')
        sio.wait()  # Keep alive
    except Exception as e:
        print(f"Connection failed: {e}")
```

#### Included Examples

**P5.js Emotion Meter**
A visualization of your cognitive state using EEG from the Muse S.
- **Location**: [`examples/device-examples/Muse S (Athena)/p5-emotion-meter`](examples/device-examples/Muse%20S%20(Athena)/p5-emotion-meter)
- **Features**: Real-time Alpha Asymmetry (mood), calibration, and smoothing.

### Heart Rate Monitor Support

Serial Bridge supports any device that uses the standard **Bluetooth Heart Rate Profile (BLE)**. This includes most modern fitness trackers and chest straps.

#### Verified Compatible Devices
- **Whoop:** 4.0 (Must enable "Broadcast Heart Rate" in Whoop app)
- **Polar:** H10, H9, OH1, Verity Sense
- **Garmin:** HRM-Pro, HRM-Dual, and most watches (in Broadcast mode)
- **Wahoo:** TICKR, TICKR X
- **Generic:** Most standard BLE heart rate straps

#### Accessing Data

When using the **"Heart Rate Monitor"** profile, data is streamed as JSON objects.

**Data Structure:**
- **`type`**: Always `'heart_rate'`.
- **`bpm`**: Heart Rate in Beats Per Minute (Integer).
- **`rr_intervals`** *(Optional)*: An array of integers representing the time between beats (in 1/1024s).
    - **Note:** This field is **only present if your device supports RR-Interval broadcasting** (e.g., Whoop, Polar H10). Cheaper sensors or some watches may not send this data.

**JavaScript:**
```javascript
// Listen for data from your heart rate monitor
bridge.onData("device_1", (data) => {
    // Parse if string, otherwise use directly
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;
   if (parsed.type === 'heart_rate') {
        // 1. Heart Rate (Always available)
        console.log("Heart Rate:", parsed.bpm);

        // 2. RR-Intervals (Only if supported by device)
        if (parsed.rr_intervals) {
            console.log("RR Intervals:", parsed.rr_intervals);
            // Use this for HRV calculations
        }
    }
});
```

#### Python Integration 

```python
import socketio

sio = socketio.Client()

@sio.on('serial-data')
def on_message(data):
    device_id = data['id']
    payload = data['data']
    
    # Ensure this is a dictionary (JSON object)
    if isinstance(payload, dict) and payload.get('type') == 'heart_rate':
        
        # 1. Heart Rate (Always available)
        bpm = payload['bpm']
        print(f"[{device_id}] Heart Rate: {bpm} BPM")
        
        # 2. RR-Intervals (Optional, if supported by device)
        if 'rr_intervals' in payload:
            rr = payload['rr_intervals']
            print(f"[{device_id}] RR Intervals: {rr}")

try:
    sio.connect('http://localhost:3000')
    sio.wait()
except Exception as e:
    print(f"Connection failed: {e}")
```





### iPhone (Sensor Bridge App)

Use your iPhone as a wireless sensor suite with the **Sensor Bridge iOS app**. Access accelerometer, gyroscope, magnetometer, GPS, barometer, and more - all streamed in real-time over Bluetooth.

#### Available Sensors
- **Motion**: Accelerometer, Gyroscope, Magnetometer
- **Orientation**: Device Motion (Pitch, Roll, Yaw), Quaternion
- **Environment**: Barometer (Pressure, Altitude)
- **Location**: GPS (Latitude, Longitude, Speed, Heading)
- **Audio**: Microphone Level
- **Advanced**: Gravity, User Acceleration (motion minus gravity)

#### How to Connect

1. Download the **Sensor Bridge** app from the iOS App Store.
2. Open the app and tap **"Start Broadcasting"**.
3. In Serial Bridge desktop app, click **"+ New Connection"**.
4. Select **Bluetooth**.
5. **Important**: In the Device Profile dropdown, select **"iPhone (via Sensor Bridge App)"**.
6. Click **"Scan"**, select your iPhone from the list, and click **"Connect"**.

#### Accessing Data

Data is streamed as JSON objects with sensor values rounded to 3 decimal places for optimal Bluetooth transmission.

**JavaScript Example - Basic Motion:**
```javascript
// Connect to Serial Bridge
bridge = new SerialBridge();

// Listen for data from your iPhone
bridge.onData("device_1", (data) => {
    // Parse if string, otherwise use directly
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;

    // Accelerometer (m/s²)
    if (parsed.accel_x !== undefined) {
        console.log("Accel:", parsed.accel_x, parsed.accel_y, parsed.accel_z);
    }

    // Gyroscope (rad/s)
    if (parsed.gyro_x !== undefined) {
        console.log("Gyro:", parsed.gyro_x, parsed.gyro_y, parsed.gyro_z);
    }

    // Device Orientation
    if (parsed.pitch !== undefined) {
        console.log("Orientation:", parsed.pitch, parsed.roll, parsed.yaw);
    }
});
```

**P5.js Example - Tilt-Controlled Circle:**
```javascript
let bridge;
let tiltX = 0;
let tiltY = 0;

function setup() {
    createCanvas(400, 400);
    bridge = new SerialBridge();

    bridge.onData("device_1", (data) => {
        let parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Use device orientation to control position
        if (parsed.roll !== undefined) {
            tiltX = map(parsed.roll, -PI, PI, 0, width);
        }
        if (parsed.pitch !== undefined) {
            tiltY = map(parsed.pitch, -PI, PI, 0, height);
        }
    });
}

function draw() {
    background(220);
    fill(100, 150, 255);
    circle(tiltX, tiltY, 50);
}
```

**Advanced Example - Quaternion for 3D Rotation:**
```javascript
// Enable Quaternion in the iOS app settings for gimbal-lock-free rotation
bridge.onData("device_1", (data) => {
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (parsed.quat_x !== undefined) {
        // Quaternion components (x, y, z, w)
        let quat = {
            x: parsed.quat_x,
            y: parsed.quat_y,
            z: parsed.quat_z,
            w: parsed.quat_w
        };
        
        // Use with Three.js or other 3D libraries
        // object3D.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    }
});
```

**GPS Example:**
```javascript
bridge.onData("device_1", (data) => {
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (parsed.latitude !== undefined) {
        console.log(`Location: ${parsed.latitude}, ${parsed.longitude}`);
        console.log(`Speed: ${parsed.speed} m/s`);
        console.log(`Heading: ${parsed.heading}°`);
    }
});
```

#### Python Integration

```python
import socketio
import json

sio = socketio.Client()

@sio.on('serial-data')
def on_message(data):
    device_id = data['id']
    payload = data['data']
    
    # Parse JSON if it's a string
    if isinstance(payload, str):
        payload = json.loads(payload)
    
    if isinstance(payload, dict):
        # Accelerometer
        if 'accel_x' in payload:
            print(f"Accel: X={payload['accel_x']}, Y={payload['accel_y']}, Z={payload['accel_z']}")
        
        # GPS Location
        if 'latitude' in payload:
            print(f"GPS: {payload['latitude']}, {payload['longitude']}")
        
        # Barometer
        if 'pressure' in payload:
            print(f"Pressure: {payload['pressure']} hPa, Altitude: {payload['altitude']} m")

try:
    sio.connect('http://localhost:3000')
    sio.wait()
except Exception as e:
    print(f"Connection failed: {e}")
```

#### Available Data Fields

| Field | Description | Unit | Example |
|-------|-------------|------|----------|
| `type` | Always `"phone_sensors"` | - | `"phone_sensors"` |
| `accel_x`, `accel_y`, `accel_z` | Accelerometer | m/s² | `-0.194` |
| `gyro_x`, `gyro_y`, `gyro_z` | Gyroscope | rad/s | `0.011` |
| `mag_x`, `mag_y`, `mag_z` | Magnetometer | µT | `483.867` |
| `pitch`, `roll`, `yaw` | Device Orientation | radians | `0.659` |
| `quat_x`, `quat_y`, `quat_z`, `quat_w` | Quaternion | - | `0.935` |
| `pressure` | Barometric Pressure | hPa | `1012.449` |
| `altitude` | Altitude | meters | `-0.161` |
| `latitude`, `longitude` | GPS Coordinates | degrees | `51.472`, `-0.087` |
| `speed` | GPS Speed | m/s | `0.000` |
| `heading` | GPS Heading | degrees | `0.000` |
| `audio_level` | Microphone Level | 0-1 | `0.002` |
| `gravity_x`, `gravity_y`, `gravity_z` | Gravity Vector | m/s² | `-0.196` |
| `user_accel_x`, `user_accel_y`, `user_accel_z` | User Acceleration (minus gravity) | m/s² | `0.002` |

> **Note**: Not all fields are present in every packet. Fields are only included when their corresponding sensor is enabled in the iOS app settings.

## API Reference

### Basic Usage (Most Common)

For most users, you'll only need these methods. The Serial Bridge desktop app handles all connection management through its UI.

#### SerialBridge Constructor

Create a new bridge connection:

```javascript
const bridge = new SerialBridge(serverUrl);
// URL is auto-detected from the socket.io.js / serial-bridge.js script tags served by the app

// Or specify a custom URL if needed:
const bridge = new SerialBridge("http://localhost:3001");
```

**Parameters:**

- `serverUrl` (string, optional): Bridge server URL. Auto-detects if not provided.

#### `onData(id, callback)`

Receive data from any connected device (Arduino, ESP32, Muse 2, etc.) via the desktop app.

```javascript
bridge.onData('device_1', (data) => {
  console.log('Received:', data);

});
```

**Parameters:**
- `id` (string): The device ID (e.g., 'device_1')
- `callback` (function): Function called when data is received

#### `onStatus(id, callback)`

Monitor connection status changes.

```javascript
bridge.onStatus('device_1', (status, port) => {

  console.log(`Status: ${status}, Port: ${port}`);
});
```

**Parameters:**

- `id` (string): The device connection ID
- `callback` (function): Function called when status changes

#### `send(id, data)`

Send data from your P5.js sketch to a connected serial device or microcontroller (e.g., Arduino, ESP32).

```javascript
// Send a command
await bridge.send('device_1', 'LED_ON');

// Send a value
await bridge.send('device_1', '128');

// Send data on button click
function mousePressed() {
  bridge.send('device_1', 'TOGGLE');
}

```

**Parameters:**

- `id` (string): The device connection ID
- `data` (string): Data to send

**Returns:** Promise

> [!IMPORTANT]
> **Two-Way Communication**: Serial Bridge supports bidirectional communication. Your P5.js sketch can both **receive** sensor data (`onData()`) and **send** commands to the device (e.g., Arduino, ESP32) (`send()`). This lets you control LEDs, motors, or adjust microcontroller behavior (e.g., Arduino, ESP32) from your web interface.
> 
> See [`examples/arduino-sketches/bidirectional-interactive`](examples/arduino-sketches/bidirectional-interactive) for a complete example of receiving commands on Arduino.

#### Wildcard Listeners

Listen to all device connections using `'*'`:

```javascript
bridge.onData("*", (data, id) => {
  console.log(`${id} sent: ${data}`);
});

bridge.onStatus("*", (status, port, id) => {
  console.log(`${id} is ${status}`);
});
```

#### RFID Methods

For RFID / NFC readers. See [RFID / NFC Readers](#rfid--nfc-readers) for examples.

- `onTagDetected(id, callback)`: called with `{ uid, type, atr }` when a tag is placed on the reader
- `onTagRemoved(id, callback)`: called when the tag is taken away
- `rfidRead(id, { block, key })`: reads a block; returns a Promise of `{ block, hex, text, raw }`
- `rfidWrite(id, { block, data, key })`: writes up to 16 bytes (text or an array of bytes) to a block
- `getRFIDReaders()`: returns a Promise of the connected readers

`block` defaults to 4 and `key` to `'FFFFFFFFFFFF'`.

### Technical Note: Data Parsing
Serial Bridge sends a message to your sketch each time a line ends. A line can end with `\n`, `\r\n` or `\r`, and spaces at either end are trimmed.

*   **Correct:** `Serial.println(value);` (sends the value and a line ending)
*   **Incomplete:** `Serial.print(value);` on its own never ends the line, so your sketch receives nothing. The Data Preview still shows the text, with a notice explaining the fix.

To send several values in one message, print them on one line and end it: `Serial.print(a); Serial.print(","); Serial.println(b);`

---

## Advanced Usage (Optional)

**Note:** The Serial Bridge desktop app must still be running for these methods to work. These methods allow you to manage connections programmatically instead of using the desktop app's UI.

### When to Use Advanced Methods

Use these if you want to:

- Build custom web interfaces for connection management
- Create automated systems that connect without user interaction
- Develop custom dashboards or teaching tools

### Advanced Methods

#### `getPorts()`

Get list of available serial ports programmatically.

```javascript
const ports = await bridge.getPorts();
console.log(ports);
```

**Returns:** Promise<object>

#### `connectSerial(id, portPath, baudRate)`

Connect to a specific serial device
```javascript
// Connect to a specific serial device
await bridge.connectSerial('device_1', '/dev/ttyUSB0', 9600);
```

**Parameters:**

- `id` (string): The device connection ID
- `portPath` (string): Serial port path
- `baudRate` (number, optional): Baud rate. Default: 9600

**Returns:** Promise

#### `disconnectSerial(id)`

Disconnect from a serial device programmatically.

```javascript
await bridge.disconnectSerial('device_1');

```

**Parameters:**

- `id` (string): The device connection ID

**Returns:** Promise

## Data Smoothing (For Beginners)

Sensors are noisy. They jitter, spike, and glitch. The Serial Bridge Client Library includes built-in functions to fix this without complex math.

### 1. `bridge.smooth(id, value, factor)`
*   **Best for:** Potentiometers, Light Sensors, Joysticks.
*   **Math:** Exponential Moving Average (EMA).
*   **What it does:** Makes values feel "heavy" and fluid, like a volume knob with resistance.

**Parameters:**
*   `id`: A unique name (string) to remember this sensor's history (e.g., "pot1").
*   `value`: The raw number coming from the sensor right now.
*   `factor`: How much smoothing to apply (0.0 to 1.0).
    *   `0.1`: Very snappy (little smoothing).
    *   `0.9`: Very slow/smooth (heavy smoothing).

```javascript
let cleanVal = bridge.smooth("pot1", rawValue, 0.8);
```

### 2. `bridge.stable(id, value, frames)`
*   **Best for:** Ultrasonic Sensors, IR Distance Sensors.
*   **Math:** Median Filter.
*   **What it does:** Ignores "glitches" and massive spikes by waiting to be sure the value is real.

**Parameters:**
*   `id`: A unique name (string) to remember this sensor's history.
*   `value`: The raw number coming from the sensor right now.
*   `frames`: How many recent values to look at (default: 5). Higher = more stable but slower.

```javascript
let dist = bridge.stable("ultra1", rawValue, 5);
```

### 3. `bridge.kalman(id, value, R, Q)`
*   **Best for:** Tracking moving objects (Advanced).
*   **Math:** 1D Kalman Filter.
*   **What it does:** Predicts movement to reduce noise while keeping speed.

**Parameters:**
*   `id`: A unique name (string) to remember this sensor's history.
*   `value`: The raw number coming from the sensor right now.
*   `R`: Measurement Noise (default: 1). Higher = Trust the sensor less (smoother).
*   `Q`: Process Noise (default: 0.1). Higher = Expect more movement (faster).

```javascript
let pos = bridge.kalman("hand", rawValue, 1, 0.1);
```

### Example: Single Sensor
If you only have one sensor sending a number (e.g., `"1023"`):

```javascript
bridge.onData("device_1", (data) => {
    // 1. Convert text to number
    let rawVal = Number(data);
    
    // 2. Smooth it
    let smoothVal = bridge.smooth("mySensor", rawVal, 0.8);
    
    // 3. Use it
    circle(width/2, height/2, smoothVal);
});
```

### Example: Handling Multiple Sensors
If your Arduino sends multiple values (e.g., `"1023,512"`), you must use a **unique ID** for each one so the bridge doesn't mix them up.

```javascript
bridge.onData("device_1", (data) => {
    // 1. Split the text into two numbers
    let values = split(data, ",");
    let rawPot = Number(values[0]);
    let rawLight = Number(values[1]);
    
    // 2. Smooth them SEPARATELY using unique IDs ("myPot", "myLight")
    let smoothPot = bridge.smooth("myPot", rawPot, 0.9);
    let smoothLight = bridge.smooth("myLight", rawLight, 0.9);

    // 3. Use the clean values
    circle(100, 100, smoothPot);
    rect(200, 200, smoothLight, 50);
});
```

## Session Management

Serial Bridge allows you to save and load your connection configurations. This is perfect for complex setups with multiple devices or specific settings (like baud rates and device profiles).

1.  **Save Session**: Click "Save Session" in the sidebar to download a `.json` file with your current configuration.
2.  **Load Session**: Click "Load Session" and select your `.json` file to restore your workspace.

> [!NOTE]
> **Bluetooth Reconnection**: Due to browser security protections (Web Bluetooth API), applications cannot automatically reconnect to Bluetooth devices without a user gesture.
>
> When loading a session with Bluetooth devices:
> 1. The device card will appear with your saved settings (Name, Profile, etc.).
> 2. You must click **Scan** and select your device again to re-establish the connection.
> 3. The app will automatically filter for the correct device type to make this quick.

### Saving a Session

Click the **"Save Session"** button in the sidebar to export your current connections as a JSON file. This saves:
- Connection names and IDs
- Connection types (USB / Bluetooth / RFID)
- Port configurations and baud rates
- Device identifiers for Bluetooth, and reader names for RFID
- **OSC settings** (broadcasting/receiving configuration, host, and ports)

**Use Cases:**
- **Gallery Installations**: Save your setup and quickly restore it if the app restarts
- **Multiple Machines**: Transfer your configuration between computers
- **Backup**: Keep a backup of your working configuration
- **Teaching**: Share connection setups with students

### Loading a Session

Click the **"Load Session"** button and select a previously saved JSON file. The app will:
1. Ask for confirmation before clearing existing connections
2. Recreate all connections from the file
3. Automatically select saved ports if they're available
4. Restore all connection settings

> [!TIP]
> If a saved port isn't currently available (e.g., device not plugged in), it will still appear in the dropdown so you can see what was configured.

### Session File Format

Sessions are saved as human-readable JSON files:

```json
{
  "version": "1.0",
  "timestamp": "2025-11-23T20:00:00.000Z",
  "connections": {
    "device_1": {
      "name": "Sensor Array",
      "type": "serial",
      "port": "/dev/tty.usbmodem14101",
      "baudRate": 9600
    },
    "device_2": {
      "name": "LED Controller",
      "type": "ble",
      "deviceId": "ABC123",
      "deviceName": "Uno R4 Bridge",
      "profile": "generic_uart"
    }
  },
  "osc": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 3333,
    "receiveEnabled": false,
    "receivePort": 3334
  }
}
```

## Dynamic Notch Notifications (macOS Only)

**Serial Bridge** integrates with the design of the hardware notch on modern MacBooks to provide unobtrusive, native-feeling status updates.

<img width="600" alt="Dynamic Notch Example" src="assets/docs/notch-example.png" />

### How it Works
When you connect or disconnect a device, a sleek notification slides down from the notch (or top of screen) to confirm the action.

| State | Color | Description |
| :--- | :--- | :--- |
| **Connected** | <span style="color: #4CD964">●</span> Green | Successful connection established |
| **Disconnected** | <span style="color: #FF3B30">●</span> Red | Device unplugged or connection failed |
| **Reconnecting** | <span style="color: #FFD60A">●</span> Yellow | Attempting to restore lost connection |

It is designed to be:
- **Unobtrusive**: Appears over fullscreen apps (like VS Code or P5.js sketches) without stealing focus.
- **Smart**: Automatically hides after 3 seconds to keep your workspace clean.

> [!NOTE]
> This feature is **hardware-exclusive**. It only activates on macOS devices with a physical notch. On Windows, Linux, or older Macs, the feature is completely disabled to save resources.

### Configuration & Performance

You can fully control this feature via the **Settings** menu:

<img width="600" alt="Settings UI" src="assets/docs/settings-example.png" />

1.  Click the **Settings** gear icon at the bottom of the sidebar.
2.  Toggle **"Dynamic Notch"** on or off.
3.  Toggle **"Notch Sounds"** to enable subtle sound effects on connection events.

**Performance Note:**
While the feature is designed to be extremely lightweight, disabling it will completely destroy the background notification window. This frees up memory and CPU resources, which can be useful if you are running on older hardware or need maximum performance for complex P5.js sketches.

> [!TIP]
> **Want to build similar notifications in your own Electron app?**
> 
> The core logic for this feature has been extracted into a standalone library: **[electron-dynamic-island](https://github.com/IrtizaNasar/electron-dynamic-island)**
> 
> This library provides a buttery-smooth, native-feeling Dynamic Island experience for Electron apps. It reverse-engineers the behavior of macOS's private APIs by calculating precise notch coordinates and managing transparent, click-through windows with hardware-accelerated CSS transitions that mimic Apple's spring physics.
> 
> Originally built for Serial Bridge's device status updates, it's now available as a polished, standalone package for any Electron developer looking to create native-quality notifications without writing Swift code.

## Examples

The `examples/` directory contains complete working examples for P5.js, Arduino, and TouchDesigner.

- **touchdesigner**:
  - `SerialBridge_TD.tox`: Drag-and-drop component for TouchDesigner
  - Multi-device OSC integration with automatic channel creation
  - See [TouchDesigner README](examples/touchdesigner/README.md) for full documentation

- **p5js-sketches**:

  - `basic-input-p5js`: Simple data visualization with a circle
  - `basic-output-p5js`: Simple mouseX control of brightness
  - `multi-input-easy-p5js`:Simple data visualization with a circle and square
  - `multi-input-array-p5js`: Visualization of an array of data via primitive shapes.
  - `store-input-p5js`: Simple data visualization with a circle and saved as a JSON file
  - `store-multi-input-p5js`: Visualization of an array of data and stored as a JSON file.
  - `bidirectional-interactive-p5js`: Simple data visualization with bar chart and line graph
  - `ble-control-p5js`: Control an LED on a Bluetooth board and read its sensor
  - `test-serial-p5js`: Utility sketch to test connection and log data

- **device-examples**:
  - `Muse S (Athena)/p5-emotion-meter`: Mood meter from EEG alpha asymmetry, with calibration

- **arduino-sketches**: Example Arduino sketches
  - `basic-sensor`: Send analog sensor data
  - `basic-send-data`: Send analog sensor data (alternative)
  - `basic-recieve-data`: Receive mouse position data to control analogWrite()
  - `send-multi-data`: Send two x analog sensor data
  - `send-multi-array-data`: Send an array of sensor data
  - `bidirectional-interactive`: Bidirectional communication with LED control
  - `ble-uno-r4.ino`: BLE example for Arduino Uno R4 WiFi
  - `ble-nano33.ino`: BLE example for Arduino Nano 33 BLE
  - `ble-esp32.ino`: BLE example for ESP32


## Configuration

### Baud Rate

The default baud rate is 9600. To use a different rate:

```javascript
// In your Arduino sketch
Serial.begin(115200);

// When connecting programmatically
await bridge.connectSerial("device_1", "/dev/cu.usbmodem14101", 115200);
```

### Server Port

The bridge server runs on port 3000 by default. If port 3000 is already in use, the application will automatically try ports 3001-3004.

**The active server URL is always displayed in the application sidebar** under "Server URL". Use this URL when including Socket.IO in your P5.js projects.



To change the default starting port, modify `serverPort` in `main.js`:

```javascript
let serverPort = 3000; // Change this to your preferred starting port
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Device (Arduino/ESP32)

- Verify the Arduino is plugged in via USB
- Check that no other application is using the serial port (close Arduino IDE Serial Monitor)
- Try refreshing the port list
- Restart the Serial Bridge application

**Problem**: "Port Busy"

- Another program has the port open. Close the Arduino IDE's Serial Monitor and Serial Plotter (and any other serial app).
- Uploading a sketch also needs the port: click **Disconnect** in Serial Bridge before uploading, then **Connect** again.

**Problem**: "Permission Needed" (Linux)

- Add yourself to the `dialout` group (see [Linux Setup](#linux-setup)), then log out and back in.

**Problem**: The device is connected but your sketch receives nothing

- End each message with `Serial.println()`. If the Data Preview shows text with a *"No line endings yet"* notice, this is the cause.
- Check the ID in your sketch matches the one on the card.

**Problem**: Data appears garbled ("Some characters look garbled")

- Ensure baud rates match between Arduino and Bridge (default: 9600). For Arduino, it's the number in `Serial.begin()`.
- Verify data is sent as simple text or numbers

### Bluetooth Issues

**Problem**: Bluetooth Connection Failed / "No Services matching UUID"

- **Golden Rule:** **Remove the device** from your computer's Bluetooth settings and **re-add it**. This solves 90% of connection issues.
- Check if you have the correct **Profile** selected for your device.
- Ensure the device is powered on and fully charged.
- Move the device closer to your computer to rule out range issues.
- Try "Forget Device" in system settings and restart your computer.

### RFID Issues

**Problem**: The reader list shows a message instead of your reader

- **Windows**: set the Smart Card service to Automatic and start it (see [Windows Setup](#windows-setup)).
- **Linux**: install and start `pcscd`. If the reader still isn't listed, turn off Linux's own NFC driver (see [Linux Setup](#linux-setup)).
- Click **"Refresh"** after plugging the reader in.

**Problem**: Read or Write fails

- Keep the tag on the reader until the action finishes.
- Check the **Auth Key**. New MIFARE Classic tags use `FFFFFFFFFFFF`.
- Block 0 and the sector trailers (3, 7, 11, …) are protected and can't be written.

### P5.js Integration Issues

**Problem**: Bridge connection fails in P5.js

- Verify Serial Bridge application is running
- Check the sidebar in the Bridge app for the server URL (e.g., "http://localhost:3001")
- Update the Socket.IO script URL to match: `<script src="http://localhost:3001/socket.io/socket.io.js"></script>`
- The `SerialBridge()` constructor will auto-detect the URL from the Socket.IO script
- Include socket.io client library before serial-bridge.js
- Check browser console for error messages

**Problem**: No data received

- Verify Arduino is connected in the Bridge app (green status indicator)
- Check ID matches the one assigned to the Arduino in the Serial Bridge app (case sensitive)
- Test with Arduino IDE Serial Monitor first



## Privacy & Analytics

Serial Bridge uses **Aptabase**, a privacy-first analytics platform, to collect anonymous usage data. This helps us understand how the tool is used and prioritize new features.

### What We Collect
- **App Version & OS**: (e.g., macOS 14.2, Windows 11)
- **Session Duration**: How long the app is open.
- **Connection Type**: Whether you are using USB or Bluetooth (we do NOT see your data).
- **Errors**: Crash reports to help us fix bugs.

### What We Do NOT Collect
- **No Personal Data**: No IP addresses, names, or emails.
- **No Serial Data**: We never see the sensor data you send or receive.
- **No File Access**: We cannot see your P5.js sketches or Arduino code.

### Opt-Out
You can disable analytics at any time:
1. Click the **Settings** (gear icon) in the sidebar.
2. Toggle **"Share Anonymous Analytics"** to OFF.
3. The app will immediately stop sending any data.





## License

**Serial Bridge** is proprietary software. See the full [LICENSE](LICENSE) for details.

| Use Case | Licence | Cost |
|----------|---------|------|
| Personal projects, hobbies, creative coding | Individual Use | Free |
| Self-directed learning | Individual Use | Free |
| University or school coursework | Commercial Licence | Paid |
| Coding bootcamp curriculum | Commercial Licence | Paid |
| Company or corporate use | Commercial Licence | Paid |
| Research institute projects | Commercial Licence | Paid |
| Example code in `/examples/` | MIT | Free |

> **Note:** If an organisation directs, recommends, or facilitates the use of Serial Bridge — even if individuals download it on their own devices — a Commercial Licence is required. Organisations may evaluate the Software for 30 days before purchasing.

For Commercial Licence enquiries, volume pricing, and educational packages, contact **Irtiza Nasar** (<irtizanasar@gmail.com>).

Copyright © 2025-2026 Irtiza Nasar. All rights reserved.

## Contributors

- **[IrtizaNasar](https://github.com/IrtizaNasar)** - Lead Developer & Maintainer
- **[j3nsykes](https://github.com/j3nsykes)** - Additional Examples & Documentation


## Built With

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Express](https://expressjs.com/) - Web server
- [Socket.IO](https://socket.io/) - WebSocket communication
- [SerialPort](https://serialport.io/) - Serial port access
- [node-osc](https://github.com/MylesBorins/node-osc) - Open Sound Control (OSC) support
- [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) - BLE Device Support
- [nfc-pcsc](https://github.com/pokusew/nfc-pcsc) - RFID / NFC reader support


## Support

If you found this project helpful, consider buying me a coffee!

<a href="https://www.buymeacoffee.com/irti">
  <img src="assets/docs/bmc-button.png" alt="Buy Me A Coffee" width="200" />
</a>
