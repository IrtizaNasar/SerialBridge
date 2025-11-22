/*
  Bidirectional Example for Serial Bridge

  This sketch:
  - RECEIVES commands from P5.js to control an LED
  - SENDS potentiometer readings back to P5.js

  Commands from P5.js:
  - "TOGGLE" - Toggle LED on/off
  - "VALUE:X" - Set LED brightness (0-9)

  Hardware:
  - LED on pin 13 (or use built-in LED)
  - Potentiometer on A0

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

const int LED_PIN = 13;
const int SENSOR_PIN = A0;
const int BAUD_RATE = 9600;
const int SEND_INTERVAL = 100; // Send sensor data every 100ms

bool ledState = false;
int ledBrightness = 128; // Default brightness (0-255)

void setup()
{
  // Initialize serial communication
  Serial.begin(BAUD_RATE);

  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);

  // Wait for serial to be ready
  while (!Serial)
  {
    ;
  }

  Serial.println("Bidirectional Serial Bridge Ready!");
}

void loop()
{
  // RECEIVE: Check for incoming commands from P5.js
  if (Serial.available() > 0)
  {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleCommand(command);
  }

  // SEND: Send potentiometer data periodically
  static unsigned long lastSend = 0;
  if (millis() - lastSend >= SEND_INTERVAL)
  {
    int sensorValue = analogRead(SENSOR_PIN);
    Serial.println(sensorValue); // Send only the number
    lastSend = millis();
  }

  // Update LED based on current state
  if (ledState)
  {
    analogWrite(LED_PIN, ledBrightness);
  }
  else
  {
    digitalWrite(LED_PIN, LOW);
  }
}

void handleCommand(String command)
{
  if (command == "TOGGLE")
  {
    // Toggle LED on/off
    ledState = !ledState;

    // Optional: Uncomment to see feedback in Serial Monitor
    // Serial.print("LED ");
    // Serial.println(ledState ? "ON" : "OFF");
  }
  else if (command.startsWith("VALUE:"))
  {
    // Extract the number (0-9) and map to brightness
    int value = command.substring(6).toInt();
    if (value >= 0 && value <= 9)
    {
      ledBrightness = map(value, 0, 9, 0, 255);

      // Optional: Uncomment to see feedback in Serial Monitor
      // Serial.print("Brightness: ");
      // Serial.println(ledBrightness);
    }
  }
}