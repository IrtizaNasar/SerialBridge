/*
  Interactive LED Example for Arduino Bridge

  This sketch listens for commands from the Arduino Bridge and controls
  an LED accordingly. It also sends sensor data back.

  Commands:
  - "TOGGLE" - Toggle LED on/off
  - "VALUE:X" - Set LED brightness (0-9)

  Hardware:
  - LED on pin 13 (or use built-in LED)
  - Optional: Potentiometer on A0

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

const int LED_PIN = 13;
const int SENSOR_PIN = A0;
const int BAUD_RATE = 9600;

bool ledState = false;
int ledBrightness = 128;  // Default brightness (0-255)

void setup() {
  // Initialize serial communication
  Serial.begin(BAUD_RATE);

  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);

  Serial.println("Arduino Bridge - Interactive LED");
  Serial.println("Commands: TOGGLE, VALUE:X (0-9)");
  Serial.println("Ready!");
}

void loop() {
  // Check for incoming commands from Arduino Bridge
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    handleCommand(command);
  }

  // Send sensor data periodically
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 100) {  // Every 100ms
    int sensorValue = analogRead(SENSOR_PIN);
    Serial.println(sensorValue);
    lastSend = millis();
  }

  // Update LED state
  if (ledState) {
    analogWrite(LED_PIN, ledBrightness);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}

void handleCommand(String command) {
  if (command == "TOGGLE") {
    ledState = !ledState;
    Serial.print("LED ");
    Serial.println(ledState ? "ON" : "OFF");

  } else if (command.startsWith("VALUE:")) {
    // Extract the number (0-9)
    int value = command.substring(6).toInt();
    if (value >= 0 && value <= 9) {
      ledBrightness = map(value, 0, 9, 0, 255);
      Serial.print("Brightness set to: ");
      Serial.println(ledBrightness);
    }
  }
}
