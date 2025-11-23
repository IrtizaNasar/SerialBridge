/*
  Two Sensor Example for Serial Bridge

  This sketch reads two analog sensors and sends both values
  to the serial port separated by a comma.

  Hardware:
  - Connect a potentiometer (or any analog sensor) to A0
  - Connect another potentiometer (or any analog sensor) to A1
  - Or just run it without sensors to see random noise

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

const int SENSOR_1_PIN = A0;
const int SENSOR_2_PIN = A1;
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

    Serial.println("Serial Bridge - Two Sensors");
    Serial.println("Ready to send data!");
}

void loop()
{
    // Read both analog sensors
    int sensor1Value = analogRead(SENSOR_1_PIN);
    int sensor2Value = analogRead(SENSOR_2_PIN);

    // Send both values separated by a comma
    // Format: "value1,value2"
    Serial.print(sensor1Value);
    Serial.print(",");
    Serial.println(sensor2Value);

    // Wait before next reading
    delay(DELAY_MS);
}