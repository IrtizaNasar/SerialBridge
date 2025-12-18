/**
 * Muse S (Athena) Profile
 * 
 * Handles connection and data parsing for the Interaxon Muse S (Gen 2 / Athena) Headset.
 * Supports EEG (Standard 4 Channels), PPG/fNIRS (Optical), Accelerometer, and Gyroscope.
 * 
 * Implements specific "Double Command" handshake required for Athena data streaming.
 * 
 * Protocol details and reverse-engineering credits:
 * Based on the 'amused-py' project (https://github.com/mowoe/amused-py).
 */

(function () {
    // Dispatcher for Muse Athena
    // Based on Amused-Py's muse_realtime_decoder.py
    function parseMuseAthenaDispatcher(dataView, type, characteristic) {
        // Athena sends Mixed packets on the Notification Handle (uuid ending in '0013')
        // We observe headers like 0xED, 0xE7, 0xDD, 0xDF, etc.
        // We will accept ANYTHING from the EEG/Mixed characteristic as a Mixed packet.

        // Characteristic Check: ends with '0013' (EEG/Mixed)
        if (characteristic && characteristic.includes('0013')) {
            return parseMuseAthenaMixed(dataView);
        }

        if (dataView.byteLength < 1) return null;
        const packetType = dataView.getUint8(0); // Byte 0 is Packet Type

        // Fallback checks
        if ((packetType & 0xF0) === 0xD0 || (packetType & 0xF0) === 0xE0) {
            // 0xDF, 0xDD, 0xED, 0xE7... all seem to be Mixed variants
            return parseMuseAthenaMixed(dataView);
        }

        switch (packetType) {
            case 0xF4: // IMU Packet
                return parseMuseAthenaIMU(dataView);
            default:
                return null;
        }
    }

    // Packet Type 0xDF Decoder (EEG + PPG)
    // Structure: [Type 1B] [Seq 2B] [Reserved 1B] [Payload...]
    function parseMuseAthenaMixed(dataView) {
        if (dataView.byteLength < 6) return null;

        const byteLength = dataView.byteLength;
        const index = dataView.getUint16(1, true); // Sequence number

        let offset = 4; // Skip 4-byte header

        const results = [];

        // Channel Map for Athena (7 Channels)
        // Amused-Py: ['TP9', 'AF7', 'AF8', 'TP10', 'FPz', 'AUX_R', 'AUX_L']
        // We only map the first 4 to standard Muse channels for now.
        const channelMap = ['tp9', 'af7', 'af8', 'tp10', 'aux_left', 'aux_right', 'fpz'];
        let channelIndex = 0;

        while (offset < byteLength) {
            // Logic from muse_realtime_decoder.py:
            // Check if it looks like EEG (18 bytes)
            if (offset + 18 <= byteLength && looksLikeEEG(dataView, offset)) {
                const samples = unpackEEGBlock(dataView, offset);

                // Block 1 = TP9 samples, Block 2 = AF7 samples, etc.
                if (channelIndex < channelMap.length) {
                    const chName = channelMap[channelIndex];

                    // We have 12 samples for this channel.
                    // For visualization, we just take the average or last one.
                    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

                    results.push({
                        type: 'eeg',
                        timestamp: Date.now(),
                        index: index,
                        channel: chName, // Internal marker
                        value: avg,
                        data: { [chName]: avg }, // Average value for real-time visualization
                        rawSamples: { [chName]: samples } // Full resolution batch
                    });
                }

                channelIndex = (channelIndex + 1) % channelMap.length;
                offset += 18;
            }
            // Check if it looks like PPG (20 bytes)
            // Check if it looks like PPG (20 bytes)
            else if (offset + 20 <= byteLength) {
                // PPG Packet found (0xDF stream)
                // Packet contains 6 samples (3 bytes per sample)
                // Mapping: [Left Amb, Left IR, Left Red, Right Amb, Right IR, Right Red]

                const ppgSamples = [];
                for (let i = 0; i < 6; i++) {
                    const o = offset + (i * 3);
                    // Read 3 bytes (Big Endian 24-bit)
                    const val = (dataView.getUint8(o) << 16) | (dataView.getUint8(o + 1) << 8) | dataView.getUint8(o + 2);
                    ppgSamples.push(val);
                }

                results.push({
                    type: 'ppg',
                    timestamp: Date.now(),
                    index: index,
                    data: {
                        ch1: ppgSamples[0],
                        ch2: ppgSamples[1],
                        ch3: ppgSamples[2],
                        ch4: ppgSamples[3],
                        ch5: ppgSamples[4],
                        ch6: ppgSamples[5]
                    }
                });

                offset += 20;
            }
            else {
                offset += 1; // Skip undefined byte
            }
        }

        // Aggregate results
        // Aggregate results from multiple blocks within the packet.
        // EEG and PPG blocks can coexist. We aggregate them into a single update frame
        // to ensure synchronized processing by the client.

        const output = {
            timestamp: Date.now(),
            index: index
        };

        let hasEeg = false;
        let hasPpg = false;

        results.forEach(res => {
            if (res.type === 'eeg') {
                if (!output.eeg) output.eeg = {};
                Object.assign(output.eeg, res.data);
                hasEeg = true;
            } else if (res.type === 'ppg') {
                if (!output.ppg) output.ppg = {};
                Object.assign(output.ppg, res.data);
                hasPpg = true;
            }
        });

        if (hasEeg) {
            // Flatten EEG for visualizer compatibility { type: 'eeg', data: { ... } }
            // Combine with PPG data if present.
            // Note: We use the 'eeg' type as the primary carrier for the UI,
            // but attach 'ppg' data to it so both can be processed in one frame.
            return JSON.stringify({
                type: 'eeg', // Primary type for UI
                timestamp: Date.now(),
                index: index,
                data: output.eeg, // Last sample (for UI "Current Value")
                ppg: output.ppg, // Last sample (for UI)
                samples: results // ALL samples (for Python Viz)
            });
        }

        if (hasPpg) {
            return JSON.stringify({
                type: 'ppg',
                timestamp: Date.now(),
                index: index,
                data: output.ppg,
                samples: results // ALL samples
            });
        }

        return null;
    }

    function looksLikeEEG(view, offset) {
        // Amused-Py check: sample = (data[0] << 4) | (data[1] >> 4)
        // return 1000 < sample < 3000
        const b0 = view.getUint8(offset);
        const b1 = view.getUint8(offset + 1);
        const sample = (b0 << 4) | (b1 >> 4);
        return (sample > 500 && sample < 3500); // Validate 12-bit range (0-4095) with tolerance.
    }

    function unpackEEGBlock(view, offset) {
        const samples = [];
        const scale = 1000.0 / 2048.0; // Standard microvolt scaling
        // Unpack 12 samples from 18 bytes (6 iterations of 3 bytes -> 2 samples)
        for (let i = 0; i < 6; i++) {
            const o = offset + (i * 3);
            const b0 = view.getUint8(o);
            const b1 = view.getUint8(o + 1);
            const b2 = view.getUint8(o + 2);

            const s1 = (b0 << 4) | ((b1 & 0xF0) >> 4);
            const s2 = ((b1 & 0x0F) << 8) | b2;

            // Centered around 2048 (12-bit)
            samples.push((s1 - 2048) * scale);
            samples.push((s2 - 2048) * scale);
        }
        return samples;
    }

    // IMU Decoder (0xF4)
    function parseMuseAthenaIMU(dataView) {
        // [Type 0xF4] [Seq 2B] [Reserved 1B] [Payload...]
        // Payload: int16 array: ax, ay, az, gx, gy, gz
        if (dataView.byteLength < 16) return null;

        const index = dataView.getUint16(1, true);
        const offset = 4;

        // Muse Athena IMU (16-bit signed)
        // Scaling factors derived from Amused-Py reference implementation.
        const imuScale = 0.0000610352; // Converts to G (1/16384)
        const gyroScale = 0.00762939;  // Converts to deg/s

        // Muse standard is typically Big Endian
        const ax = dataView.getInt16(offset, false) * imuScale;
        const ay = dataView.getInt16(offset + 2, false) * imuScale;
        const az = dataView.getInt16(offset + 4, false) * imuScale;
        const gx = dataView.getInt16(offset + 6, false) * gyroScale;
        const gy = dataView.getInt16(offset + 8, false) * gyroScale;
        const gz = dataView.getInt16(offset + 10, false) * gyroScale;

        return JSON.stringify({
            type: 'imu', // Clearer type name (contains both)
            timestamp: Date.now(),
            index: index,
            data: {
                accel: { x: ax, y: ay, z: az },
                gyro: { x: gx, y: gy, z: gz }
            }
        });
    }

    window.registerProfile('muse_athena', {
        name: 'Muse S (Athena)',
        service: 0xfe8d,
        enableKeepAlive: false, // Disable read-based keep-alive to prevent GATT errors
        // "Double Command" Handshake + Preset Sequence (Amused-Py Protocol)
        // 1. Halt (h)
        // 2. Preset (p1035) - Full Sensor Mode
        // 3. Start (dc001) - Sent twice
        startSequence: [
            {
                description: 'CMD: Halt (h)',
                value: [0x02, 0x68, 0x0a], // 'h'
                wait: 100
            },
            {
                description: 'CMD: Preset (p1035)',
                // "p1035\n" -> 6 bytes total. Length byte = 0x06.
                value: [0x06, 0x70, 0x31, 0x30, 0x33, 0x35, 0x0a],
                wait: 500
            },
            {
                description: 'CMD: Start (dc001) - 1',
                // "dc001\n" -> 6 bytes total. Length byte = 0x06.
                value: [0x06, 0x64, 0x63, 0x30, 0x30, 0x31, 0x0a],
                wait: 500
            },
            {
                description: 'CMD: Start (dc001) - 2',
                value: [0x06, 0x64, 0x63, 0x30, 0x30, 0x31, 0x0a],
                wait: 100
            }
        ],
        characteristics: {
            '273e0013-4c4d-454d-96be-f03bac821358': 'eeg',   // Stream 1 (Mixed 0xDF)
            '273e0014-4c4d-454d-96be-f03bac821358': 'ppg',   // Stream 2
            '273e0015-4c4d-454d-96be-f03bac821358': 'accel'  // Stream 3
        },
        controlCharacteristic: '273e0001-4c4d-454d-96be-f03bac821358', // Confirmed
        parser: parseMuseAthenaDispatcher
    });
})();
