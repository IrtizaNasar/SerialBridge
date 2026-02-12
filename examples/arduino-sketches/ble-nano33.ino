/*
 * Serial Bridge - Arduino Nano 33 BLE Example
 *
 * This sketch demonstrates bidirectional communication between
 * Arduino Nano 33 BLE and Serial Bridge via Bluetooth Low Energy.
 *
 * Features:
 * - Sends sensor data (A0) to Serial Bridge
 * - Receives commands from P5.js via Serial Bridge
 * - Controls built-in LED based on received data
 *
 * Hardware:
 * - Arduino Nano 33 BLE / Nano 33 BLE Sense
 * - Optional: Potentiometer or sensor on A0
 * - Built-in LED on pin 13
 *
 * Setup:
 * 1. Install ArduinoBLE library (Tools > Manage Libraries > search
 * "ArduinoBLE")
 * 2. Upload this sketch to your Nano 33 BLE
 * 3. Open Serial Bridge app
 * 4. Click "Scan" in a Bluetooth connection
 * 5. Select "Nano BLE Bridge" from the list
 * 6. Click "Connect"
 */

#include <ArduinoBLE.h>

// BLE Service and Characteristics
// Using Nordic UART Service (NUS) UUIDs - same as Serial Bridge expects
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");

// RX Characteristic - Serial Bridge writes to this (Arduino receives)
BLECharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite,
                         20); // Max 20 bytes per BLE packet

// TX Characteristic - Arduino writes to this (Serial Bridge receives)
BLECharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
                         BLERead | BLENotify, 20);

const int LED_PIN = 13;    // Built-in LED
const int SENSOR_PIN = A0; // Analog sensor input
unsigned long lastSendTime = 0;
const int SEND_INTERVAL = 100; // Send data every 100ms

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);

  // Initialize BLE
  if (!BLE.begin()) {
    Serial.println("Starting BLE failed!");
    while (1)
      ; // Halt if BLE initialization fails
  }

  // Set up BLE device name FIRST, before adding service
  // IMPORTANT: Change this to identify YOUR specific device!
  BLE.setLocalName("NANO_SENSOR_1"); // ← CHANGE THIS for each board!
  BLE.setAdvertisedService(uartService);

  // Add characteristics to service
  uartService.addCharacteristic(rxChar);
  uartService.addCharacteristic(txChar);

  // Add service
  BLE.addService(uartService);

  // Start advertising
  BLE.advertise();

  Serial.println("Nano 33 BLE ready!");
  Serial.println("Waiting for connection...");
}

void loop() {
  // Wait for a BLE central device (Serial Bridge app)
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());
    digitalWrite(LED_PIN, HIGH); // Turn on LED when connected

    // While connected
    while (central.connected()) {
      // Check if data was received from Serial Bridge (P5.js)
      if (rxChar.written()) {
        handleReceivedData();
      }

      // Send sensor data periodically
      if (millis() - lastSendTime >= SEND_INTERVAL) {
        sendSensorData();
        lastSendTime = millis();
      }
    }

    // Disconnected
    digitalWrite(LED_PIN, LOW);
    Serial.println("Disconnected");
  }
}

/**
 * Handles data received from Serial Bridge (sent from P5.js)
 * Commands:
 * - "LED_ON" - Turn LED on
 * - "LED_OFF" - Turn LED off
 * - "TOGGLE" - Toggle LED state
 * - Any number 0-255 - Set LED brightness (PWM)
 */
void handleReceivedData() {
  // Get the value that was written to the characteristic
  int dataLength = rxChar.valueLength();

  if (dataLength > 0) {
    // Read the value into a buffer
    uint8_t buffer[20];
    rxChar.readValue(buffer, dataLength);

    // Convert to String
    String received = "";
    for (int i = 0; i < dataLength; i++) {
      received += (char)buffer[i];
    }

    received.trim(); // Remove whitespace

    Serial.print("Received: ");
    Serial.println(received);

    // Process commands
    if (received == "LED_ON") {
      digitalWrite(LED_PIN, HIGH);
      sendResponse("LED turned ON");
    } else if (received == "LED_OFF") {
      digitalWrite(LED_PIN, LOW);
      sendResponse("LED turned OFF");
    } else if (received == "TOGGLE") {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      sendResponse("LED toggled");
    } else {
      // Try to parse as a number for brightness control
      int brightness = received.toInt();
      if (brightness >= 0 && brightness <= 255) {
        analogWrite(LED_PIN, brightness);
        sendResponse("Brightness set to " + String(brightness));
      }
    }
  }
}

/**
 * Sends sensor data to Serial Bridge
 * Reads analog value from A0 and sends it
 */
void sendSensorData() {
  int sensorValue = analogRead(SENSOR_PIN);
  String data = String(sensorValue);

  // Send via BLE (max 20 bytes per packet)
  if (data.length() <= 20) {
    txChar.writeValue(data.c_str());
  }
}

/**
 * Sends a response message to Serial Bridge
 */
void sendResponse(String message) {
  if (message.length() <= 20) {
    txChar.writeValue(message.c_str());
  }
  Serial.println("Sent: " + message);
}
