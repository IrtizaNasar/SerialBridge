/*
  Multiple Sensor Example with Array for Serial Bridge

  This sketch reads multiple analog sensors using an array and sends
  all values to the serial port separated by commas.

  Hardware:
  - Connect sensors to A0, A1, A2 (or add more pins to the array)
  - Or just run it without sensors to see random noise

  Easy to scale: Just add more pin numbers to the sensorPins array!

  Next Steps:
  - This method of using an array would work with more complex sensors such as many capacitive electrode sensors or an accelerometer

  Compatible with Arduino Uno, Nano, Mega, etc.
*/

// Array of sensor pins - add or remove pins here to scale easily!
const int sensorPins[] = {A0, A1, A2};

// Calculate how many sensors we have
const int NUM_SENSORS = sizeof(sensorPins) / sizeof(sensorPins[0]);

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

    Serial.println("Serial Bridge - Multiple Sensors with Array");
    Serial.print("Number of sensors: ");
    Serial.println(NUM_SENSORS);
    Serial.println("Ready to send data!");
}

void loop()
{
    // Loop through all sensors and send their values
    for (int i = 0; i < NUM_SENSORS; i++)
    {
        // Read the current sensor
        int sensorValue = analogRead(sensorPins[i]);

        // Print the value
        Serial.print(sensorValue);

        // Add a comma after each value except the last one
        if (i < NUM_SENSORS - 1)
        {
            Serial.print(",");
        }
    }

    // End the line after all values are sent
    Serial.println();

    // Wait before next reading
    delay(DELAY_MS);
}