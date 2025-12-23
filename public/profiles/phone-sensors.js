/**
 * Phone Sensors Profile (iOS/Android)
 * Receives sensor data from Sensor Bridge mobile app
 */

(function () {
    /**
     * Parses phone sensor data (accelerometer, gyroscope)
     * Returns: { type: 'phone_sensors', accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z }
     */
    function parsePhoneSensors(value) {
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(value);

        try {
            const data = JSON.parse(jsonString);
            return data; // Already in correct format
        } catch (e) {
            console.error('Failed to parse phone sensor data:', e);
            console.error('Malformed JSON string:', jsonString);
            console.error('JSON length:', jsonString.length);
            return null;
        }
    }

    window.registerProfile('phone_sensors', {
        name: 'iPhone (via Sensor Bridge App)',
        service: '0000ffe0-0000-1000-8000-00805f9b34fb',
        characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb',
        parser: parsePhoneSensors
    });
})();
