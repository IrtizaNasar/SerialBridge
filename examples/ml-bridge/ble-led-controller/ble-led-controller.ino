/*
  ML Bridge - BLE LED Controller
  ===============================

  This sketch connects your Arduino wirelessly to ML Bridge via Bluetooth.
  It turns an LED ON or OFF based on predictions from your machine learning
  model.

  HARDWARE:
  - Arduino Uno R4 WiFi (has built-in Bluetooth)
  - Built-in LED (Pin 13) or external LED on Pin 2

  HOW TO USE:
  1. Upload this code to your Arduino.
  2. Open "Serial Bridge" on your computer.
  3. Click "+ New Connection" -> Select "Bluetooth".
  4. Choose Profile: "Generic BLE UART".
  5. Scan and connect to "Arduino_LED".
  6. Send data from ML Bridge (class_1 turns LED ON).
*/

#include <ArduinoBLE.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
// Which pin is your LED connected to?
// On Uno R4 WiFi, the built-in yellow LED is PIN 13.
const int LED_PIN = 13;

// --- BLUETOOTH SETTINGS (Do not change) ---
// These are standard "Nordic UART" IDs that Serial Bridge recognizes.
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic txCharacteristic("6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
                                   BLENotify, 512); // To send to computer
BLECharacteristic rxCharacteristic("6E400002-B5A3-F393-E0A9-E50E24DCCA9E",
                                   BLEWrite, 512); // To receive from computer

// Buffer to store incoming text
String messageBuffer = "";

void setup() {
  Serial.begin(9600);

  // 1. Setup LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Start OFF

  Serial.println("Starting ML Bridge BLE Controller...");

  // 2. Start Bluetooth
  if (!BLE.begin()) {
    Serial.println("Error: Could not start Bluetooth!");
    while (1)
      ; // Stop here if failed
  }

  // 3. Name your device (This appears in the scan list)
  BLE.setLocalName("Arduino_LED");
  BLE.setDeviceName("Arduino_LED");

  // 4. Setup the Bluetooth Service
  BLE.setAdvertisedService(uartService);
  uartService.addCharacteristic(txCharacteristic);
  uartService.addCharacteristic(rxCharacteristic);
  BLE.addService(uartService);

  // 5. Start Advertising (Make device visible)
  BLE.advertise();

  Serial.println("Bluetooth Started! Waiting for Serial Bridge to connect...");
}

void loop() {
  // Check if a computer is connected
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());

    // Blink LED 3 times to say "Hello"
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }

    // Keep running while connected
    while (central.connected()) {

      // Is there new data?
      if (rxCharacteristic.written()) {
        readIncomingData();
      }

      delay(10); // Small pause for stability
    }

    Serial.println("Disconnected.");
    digitalWrite(LED_PIN, LOW); // Turn off LED when disconnected
  }
}

// --- HELPER FUNCTIONS ---

void readIncomingData() {
  // Read the raw bytes from Bluetooth
  int length = rxCharacteristic.valueLength();
  const uint8_t *value = rxCharacteristic.value();

  // Add each character to our buffer
  for (int i = 0; i < length; i++) {
    char c = (char)value[i];

    // If we see a newline (\n), the message is complete
    if (c == '\n') {
      handleMessage(messageBuffer); // Process the full message
      messageBuffer = "";           // Clear buffer for next time
    } else {
      messageBuffer += c; // Add character to buffer
    }
  }
}

void handleMessage(String jsonString) {
  Serial.print("Received: ");
  Serial.println(jsonString);

  // 1. Parse the JSON data
  // ML Bridge sends: {"label": "class_1", "confidence": 0.99}
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, jsonString);

  if (error) {
    Serial.println("Error: Could not parse JSON");
    return;
  }

  // 2. Get the label
  const char *label = doc["label"];
  if (!label)
    return; // No label found

  Serial.print("Class Detected: ");
  Serial.println(label);

  // 3. Control the LED
  if (strcmp(label, "class_1") == 0) {
    digitalWrite(LED_PIN, HIGH); // Turn ON
    Serial.println("-> LED ON");
  } else {
    digitalWrite(LED_PIN, LOW); // Turn OFF
    Serial.println("-> LED OFF");
  }
}
