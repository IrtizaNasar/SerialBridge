/*
  Basic Arduino Sensor Example for Serial Bridge

  This sketch reads an analog sensor on pin A0 and sends the value
  to the serial port. The Serial Bridge will capture this data and
  make it available to your P5.js sketches.

  Hardware:
  - Connect a potentiometer (or any analog sensor) to A0
  - Or just run it without a sensor to see random noise

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

const int SENSOR_PIN = A0;
const int BAUD_RATE = 9600;
const int DELAY_MS = 50; // Send data every 50ms (20 times per second)

void setup()
{
    // Initialize serial communication
    Serial.begin(BAUD_RATE);

    // Wait for serial port to connect (needed for some boards)
    while (!Serial)
    {
        ;
    }

    Serial.println("Serial Bridge - Basic Sensor");
    Serial.println("Ready to send data!");
}

void loop()
{
    // Read the analog sensor
    int sensorValue = analogRead(SENSOR_PIN);

    // Send the value to serial (Serial Bridge will capture this)
    Serial.println(sensorValue);

    // Wait before next reading
    delay(DELAY_MS);
}
