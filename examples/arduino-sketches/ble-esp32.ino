/*
  ESP32 - BLE Serial Bridge

  This sketch allows the ESP32 to communicate with the
  Serial Bridge app via Bluetooth Low Energy (BLE).

  It implements the Nordic UART Service (NUS), which is a standard way
  to send serial data over BLE.

  Compatible with: ESP32, ESP32-S3, ESP32-C3, and other ESP32 variants

  UUIDs:
  - Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
  - RX Char: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E (Write)
  - TX Char: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E (Notify)
*/

#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// Nordic UART Service UUIDs
#define SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
bool oldDeviceConnected = false;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("Device connected");
  };

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("Device disconnected");
  }
};

class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string rxValue = pCharacteristic->getValue();

    if (rxValue.length() > 0) {
      Serial.print("Received: ");
      for (int i = 0; i < rxValue.length(); i++) {
        Serial.print(rxValue[i]);
      }
      Serial.println();

      // Handle commands here
      // Example: if (rxValue == "LED_ON") digitalWrite(LED_BUILTIN, HIGH);
    }
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE UART Service...");

  // Create the BLE Device
  BLEDevice::init("ESP32 Bridge");

  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE Characteristic for TX (sending data to app)
  pTxCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);

  pTxCharacteristic->addDescriptor(new BLE2902());

  // Create a BLE Characteristic for RX (receiving data from app)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);

  pRxCharacteristic->setCallbacks(new MyCallbacks());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(
      0x06); // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE UART Ready! Connect from Serial Bridge app.");
}

void loop() {
  // Handle disconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);                  // give the bluetooth stack time to get ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("Advertising restarted - device is discoverable again");
    oldDeviceConnected = deviceConnected;
  }

  // Handle new connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Send data to app when connected
  if (deviceConnected) {
    // Example: Send analog reading every 200ms
    static unsigned long lastTime = 0;
    if (millis() - lastTime > 200) {
      lastTime = millis();

      // Read analog value (ESP32 ADC is 12-bit, 0-4095)
      int sensorValue = analogRead(34); // Use GPIO 34 for analog input
      String msg = String(sensorValue) + "\n";

      pTxCharacteristic->setValue(msg.c_str());
      pTxCharacteristic->notify();

      Serial.print("Sent: ");
      Serial.print(msg);
    }
  }
}
