/**
 * Muse 2 Headset Profile
 * 
 * Handles connection and data parsing for the Interaxon Muse 2 EEG Headset.
 * Supports EEG (4 channels), PPG (3 channels), Accelerometer, and Gyroscope.
 * 
 * Protocol details based on community reverse-engineering efforts.
 */

(function () {
    // Dispatcher for Muse 2
    function parseMuseDispatcher(dataView, type) {
        switch (type) {
            case 'eeg': return parseMuseEEG(dataView);
            case 'ppg': return parseMusePPG(dataView);
            case 'accel': return parseMuseAccel(dataView);
            case 'gyro': return parseMuseGyro(dataView);
            default: return null;
        }
    }

    // Parse Muse 2 EEG
    function parseMuseEEG(dataView) {
        const byteLength = dataView.byteLength;
        if (byteLength < 10) return null;

        const packetIndex = dataView.getUint16(0, false); // Big Endian

        // Muse EEG data is packed into 12-bit samples.
        // A block of 3 bytes contains 2 samples:
        // Byte 0: [Sample 1 (8 bits)]
        // Byte 1: [Sample 1 (4 bits)] [Sample 2 (4 bits)]
        // Byte 2: [Sample 2 (8 bits)]
        function unpackSamples(offset) {
            const b0 = dataView.getUint8(offset);
            const b1 = dataView.getUint8(offset + 1);
            const b2 = dataView.getUint8(offset + 2);

            const s1 = (b0 << 4) | ((b1 & 0xF0) >> 4);
            const s2 = ((b1 & 0x0F) << 8) | b2;

            return [s1, s2];
        }

        const block1 = unpackSamples(2);
        const block2 = unpackSamples(5);
        const center = 2048;

        const eegData = {
            type: 'eeg',
            timestamp: Date.now(),
            index: packetIndex,
            data: {
                tp9: block1[0] - center,
                af7: block1[1] - center,
                af8: block2[0] - center,
                tp10: block2[1] - center,
                aux: 0
            }
        };

        return JSON.stringify(eegData);
    }

    // Parse Muse 2 IMU (Accel/Gyro)
    function parseMuseIMU(dataView, type, scale) {
        if (dataView.byteLength < 8) return null;
        const index = dataView.getUint16(0, false);
        const x = dataView.getInt16(2, false) * scale;
        const y = dataView.getInt16(4, false) * scale;
        const z = dataView.getInt16(6, false) * scale;

        return JSON.stringify({
            type: type,
            timestamp: Date.now(),
            index: index,
            data: { x, y, z }
        });
    }

    function parseMuseAccel(dataView) {
        // Scale factor: 0.0000610352 (2g range)
        return parseMuseIMU(dataView, 'accel', 0.0000610352);
    }

    function parseMuseGyro(dataView) {
        // Scale factor: 0.0074768 (245dps range)
        return parseMuseIMU(dataView, 'gyro', 0.0074768);
    }

    // Parse Muse 2 PPG
    // 3 channels: Ambient, IR, Red
    function parseMusePPG(dataView) {
        if (dataView.byteLength < 8) return null;
        const index = dataView.getUint16(0, false);
        // PPG values are usually 24-bit, but packed? 
        // For now assuming 3x Uint16 for simplicity, will refine if needed.
        const ch1 = dataView.getUint16(2, false);
        const ch2 = dataView.getUint16(4, false);
        const ch3 = dataView.getUint16(6, false);

        return JSON.stringify({
            type: 'ppg',
            timestamp: Date.now(),
            index: index,
            data: { ch1, ch2, ch3 }
        });
    }

    window.registerProfile('muse_2', {
        name: 'Muse 2 Headset',
        service: 0xfe8d,
        characteristics: {
            '273e0003-4c4d-454d-96be-f03bac821358': 'eeg',
            '273e000f-4c4d-454d-96be-f03bac821358': 'ppg',
            '273e000a-4c4d-454d-96be-f03bac821358': 'accel',
            '273e0009-4c4d-454d-96be-f03bac821358': 'gyro'
        },
        controlCharacteristic: '273e0001-4c4d-454d-96be-f03bac821358',
        parser: parseMuseDispatcher
    });
})();
