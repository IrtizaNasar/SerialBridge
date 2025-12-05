/**
 * Heart Rate Monitor Profile (Standard BLE Service)
 * Works with Whoop, Polar, Garmin, etc.
 */

(function () {
    /**
     * Parses standard BLE Heart Rate Measurement (0x2A37)
     * Returns: { type: 'heart_rate', bpm: number, rr_intervals: number[] }
     */
    function parseHeartRate(value) {
        const flags = value.getUint8(0);
        const rate16Bits = flags & 0x1;
        const result = { type: 'heart_rate' };
        let offset = 1;

        if (rate16Bits) {
            result.bpm = value.getUint16(offset, true);
            offset += 2;
        } else {
            result.bpm = value.getUint8(offset);
            offset += 1;
        }

        const contactDetected = flags & 0x2;
        const energyPresent = flags & 0x8;
        const rrIntervalPresent = flags & 0x10;

        if (energyPresent) {
            result.energyExpended = value.getUint16(offset, true);
            offset += 2;
        }

        if (rrIntervalPresent) {
            const rrIntervals = [];
            while (offset + 1 < value.byteLength) {
                const rr = value.getUint16(offset, true);
                rrIntervals.push(rr);
                offset += 2;
            }
            result.rr_intervals = rrIntervals;
        }

        return result;
    }

    window.registerProfile('heart_rate', {
        name: 'Heart Rate Monitor (Whoop, Polar, Garmin, Generic)',
        service: 'heart_rate',
        characteristic: 'heart_rate_measurement',
        parser: parseHeartRate
    });
})();
