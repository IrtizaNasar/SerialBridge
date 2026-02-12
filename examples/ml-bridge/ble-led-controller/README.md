# ML Bridge - BLE LED Controller Example

This example shows how to wirelessly control an LED on your **Arduino Uno R4 WiFi** using machine learning.

When **ML Bridge** detects a specific object or gesture (e.g., "Class 1"), it sends a command via Bluetooth to turn on the LED.

## What You Need
*   **Arduino Uno R4 WiFi** (This board has built-in Bluetooth).
*   **LED** (The board has a built-in one on Pin 13, so no extra wiring needed!).

---

## Step 1: Upload Code to Arduino

1.  Open `ble-led-controller.ino` in your **Arduino IDE**.
2.  Make sure you have the **ArduinoBLE** and **ArduinoJson** libraries installed.
    *   *Sketch -> Include Library -> Manage Libraries...*
    *   Search for "ArduinoBLE" and install it.
    *   Search for "ArduinoJson" and install it.
3.  Select your board: **Arduino Uno R4 WiFi**.
4.  Click **Upload**.
5.  Open the **Serial Monitor** (Tools -> Serial Monitor) and set baud rate to **9600**. You should see:
    > "Bluetooth Started! Waiting for Serial Bridge to connect..."

---

## Step 2: Connect via Serial Bridge

1.  Open the **Serial Bridge** app on your computer.
2.  Click **"+ New Connection"**.
3.  Set Type to **Bluetooth**.
4.  Set Profile to **Generic BLE UART**.
5.  Click **Scan** and select **"Arduino_LED"** from the list.
6.  Click **Connect**.
    *   *Your Arduino's built-in LED should blink 3 times to say hello!*

---

## Step 3: Use with ML Bridge

1.  Open **ML Bridge**.
2.  Train a model with at least two classes:
    *   `class_1` (This will turn the LED **ON**)
    *   `class_2` (This will turn the LED **OFF**)
3.  Switch inputs or hold up objects to trigger predictions.
4.  Watch your Arduino LED turn on and off wirelessly!

---

## How It Works 

1.  **ML Bridge** analyzes your video/audio and predicts a "Label" (e.g., "class_1").
2.  It sends this label as a **JSON message** via Bluetooth:
    ```json
    {"label": "class_1", "confidence": 0.98}
    ```
3.  The **Arduino** receives this text, reads the "label" part, and decides whether to turn Pin 13 HIGH or LOW.

### Troubleshooting
*   **Arduino not showing up?** Press the small RESET button on the Arduino board and try scanning again.
*   **Upload failed?** Make sure you selected the correct COM/Serial port in Arduino IDE.
