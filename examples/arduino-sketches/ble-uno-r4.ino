/*
  Arduino Uno R4 WiFi - BLE Serial Bridge

  This sketch allows the Arduino Uno R4 WiFi to communicate with the
  Serial Bridge app via Bluetooth Low Energy (BLE).

  It implements the Nordic UART Service (NUS), which is a standard way
  to send serial data over BLE.

  UUIDs:
  - Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
  - RX Char: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E (Write)
  - TX Char: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E (Notify)
*/

#include <ArduinoBLE.h>

BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");

// RX Characteristic (Receive from App)
BLEStringCharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite,
                               20);

// TX Characteristic (Send to App)
BLEStringCharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
                               BLERead | BLENotify, 20);

void setup() {
  Serial.begin(9600);
  while (!Serial)
    ;

  if (!BLE.begin()) {
    Serial.println("starting BLE failed!");
    while (1)
      ;
  }

  // Set advertised local name and service UUID
  BLE.setLocalName("Uno R4 Bridge");
  BLE.setAdvertisedService(uartService);

  // Add characteristics to the service
  uartService.addCharacteristic(rxChar);
  uartService.addCharacteristic(txChar);

  // Add service
  BLE.addService(uartService);

  // Start advertising
  BLE.advertise();

  Serial.println("BLE UART Ready! Connect from Serial Bridge app.");
}

void loop() {
  // Poll for BLE events
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to central: ");
    Serial.println(central.address());

    while (central.connected()) {
      // 1. Receive data from App
      if (rxChar.written()) {
        String received = rxChar.value();
        Serial.print("Received: ");
        Serial.println(received);

        // Handle commands here
        // if (received == "LED_ON") digitalWrite(LED_BUILTIN, HIGH);
      }

      // 2. Send data to App (Example: Send millis every second)
      static unsigned long lastTime = 0;
      if (millis() - lastTime > 200) { // Faster updates for testing
        lastTime = millis();

        String msg = String(analogRead(A0)) + "\n";
        txChar.writeValue(msg);

        Serial.print("Sent: ");
        Serial.print(msg);
      }
    }

    Serial.print("Disconnected from central: ");
    Serial.println(central.address());

    // IMPORTANT: Restart advertising so the device can be found again
    BLE.advertise();
    Serial.println("Advertising restarted - device is discoverable again");
  }
}
