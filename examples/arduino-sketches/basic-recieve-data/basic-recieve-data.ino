/*
  LED Control from P5.js via Serial Bridge

  This sketch receives mouseX values from P5.js and uses them
  to control the brightness of an LED.

  Hardware:
  - LED on pin 9 (needs PWM pin for brightness control)
  - Or use built-in LED on pin 13

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

const int LED_PIN = 9; // Use pin 9 for PWM (brightness control)
const int BAUD_RATE = 9600;

void setup()
{
    // Initialize serial communication
    Serial.begin(BAUD_RATE);

    // Initialize LED pin
    pinMode(LED_PIN, OUTPUT);

    Serial.println("LED Control Ready!");
    Serial.println("Waiting for brightness values...");
}

void loop()
{
    // Check if data is available from P5.js
    if (Serial.available() > 0)
    {
        // Read the incoming value
        String incoming = Serial.readStringUntil('\n');
        incoming.trim();

        // Convert to number
        int brightness = incoming.toInt();

        // Make sure value is in valid range (0-255)
        brightness = constrain(brightness, 0, 255);

        // Set LED brightness
        analogWrite(LED_PIN, brightness);

        // Print confirmation (optional)
        Serial.print("LED brightness set to: ");
        Serial.println(brightness);
    }
}