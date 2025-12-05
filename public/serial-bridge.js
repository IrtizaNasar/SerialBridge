/**
 * Serial Bridge Client Library
 *
 * A simple client library for connecting P5.js sketches to the Serial Bridge.
 *
 * Usage:
 *   const bridge = new SerialBridge();
 *   // or specify a custom URL/port:
 *   const bridge = new SerialBridge('http://localhost:3001');
 *
 *   bridge.onData('device_1', (data) => {
 *     console.log('Received:', data);
 *   });
 */

class SerialBridge {
    constructor(serverUrl) {
        // Auto-detect server URL if not provided
        if (!serverUrl) {
            // Try to detect from the socket.io script tag
            const socketScript = document.querySelector('script[src*="socket.io"]');
            if (socketScript) {
                const src = socketScript.getAttribute('src');
                const match = src.match(/^(https?:\/\/[^\/]+)/);
                if (match) {
                    serverUrl = match[1];
                }
            }
            // Fallback to default
            if (!serverUrl) {
                serverUrl = 'http://localhost:3000';
            }
        }

        this.serverUrl = serverUrl;
        this.socket = null;
        this.dataHandlers = new Map();
        this.statusHandlers = new Map();
        this.connected = false;

        // Smoothing State
        this.smoothState = new Map();
        this.stableState = new Map();
        this.kalmanState = new Map();

        this.connect();
    }

    /**
     * Connect to the Serial Bridge server
     */
    connect() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO not loaded. Please include the Socket.IO client library before serial-bridge.js');
            return;
        }

        this.socket = io(this.serverUrl);

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('🌉 Connected to Serial Bridge');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('🔌 Disconnected from Serial Bridge');
        });

        this.socket.on('serial-data', (data) => {
            const { id, data: serialData } = data;

            // Call specific handler for this Arduino ID
            if (this.dataHandlers.has(id)) {
                this.dataHandlers.get(id).forEach(handler => handler(serialData));
            }

            // Call wildcard handlers
            if (this.dataHandlers.has('*')) {
                this.dataHandlers.get('*').forEach(handler => handler(serialData, id));
            }
        });

        this.socket.on('connection-status', (data) => {
            const { id, status, port } = data;

            // Call specific handler for this Arduino ID
            if (this.statusHandlers.has(id)) {
                this.statusHandlers.get(id).forEach(handler => handler(status, port));
            }

            // Call wildcard handlers
            if (this.statusHandlers.has('*')) {
                this.statusHandlers.get('*').forEach(handler => handler(status, port, id));
            }
        });
    }

    /**
     * Register a callback for data from a specific device
     * @param {string} id - The device ID (e.g., 'device_1') or '*' for all
     * @param {function} callback - Function to call when data is received
     */
    onData(id, callback) {
        if (!this.dataHandlers.has(id)) {
            this.dataHandlers.set(id, []);
        }
        this.dataHandlers.get(id).push(callback);
        return this;
    }

    /**
     * Register a callback for connection status changes
     * @param {string} id - The device ID (e.g., 'device_1') or '*' for all
     * @param {function} callback - Function to call when status changes (status, port, id)
     */
    onStatus(id, callback) {
        if (!this.statusHandlers.has(id)) {
            this.statusHandlers.set(id, []);
        }
        this.statusHandlers.get(id).push(callback);
        return this;
    }

    /**
     * Send data to a specific device
     * @param {string} id - The device ID (e.g., 'device_1')
     * @param {string} data - Data to send
     */
    async send(id, data) {
        try {
            const response = await fetch(`${this.serverUrl}/api/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, data: data })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('Failed to send data:', error);
            throw error;
        }
    }

    /**
     * Get list of available ports
     */
    async getPorts() {
        try {
            const response = await fetch(`${this.serverUrl}/api/ports`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get ports:', error);
            throw error;
        }
    }

    /**
     * Connect to a serial device on a specific port
     * @param {string} id - The device ID (e.g., 'device_1')
     * @param {string} portPath - The port path (e.g., '/dev/cu.usbmodem14101')
     * @param {number} baudRate - Baud rate (default: 9600)
     */
    async connectSerial(id, portPath, baudRate = 9600) {
        try {
            const response = await fetch(`${this.serverUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, portPath, baudRate })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('Failed to connect serial device:', error);
            throw error;
        }
    }

    /**
     * @deprecated Use connectSerial() instead
     */
    async connectArduino(arduinoId, portPath, baudRate = 9600) {
        console.warn('Deprecation Warning: connectArduino() is deprecated. Please use connectSerial() instead.');
        return this.connectSerial(arduinoId, portPath, baudRate);
    }

    /**
     * Disconnect from a serial device
     * @param {string} id - The device ID
     */
    async disconnectSerial(id) {
        try {
            const response = await fetch(`${this.serverUrl}/api/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('Failed to disconnect serial device:', error);
            throw error;
        }
    }

    /**
     * @deprecated Use disconnectSerial() instead
     */
    async disconnectArduino(arduinoId) {
        console.warn('Deprecation Warning: disconnectArduino() is deprecated. Please use disconnectSerial() instead.');
        return this.disconnectSerial(arduinoId);
    }

    /**
     * Check if connected to the bridge server
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Disconnect from the bridge server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // ==========================================
    // DATA SMOOTHING API (Beginner Friendly)
    // ==========================================

    /**
     * Smooths a value using Exponential Moving Average (EMA).
     * Great for making jittery sensors (pots, light sensors) feel "heavy" and fluid.
     * 
     * @param {string} id - Unique ID for this sensor (e.g., "pot1")
     * @param {number} val - The raw new value
     * @param {number} factor - Smoothing factor (0.0 - 1.0). 
     *                          0.1 = Very snappy (little smoothing)
     *                          0.9 = Very slow/smooth (heavy smoothing)
     * @returns {number} The smoothed value
     */
    smooth(id, val, factor = 0.8) {
        if (!this.smoothState.has(id)) {
            this.smoothState.set(id, val);
            return val;
        }

        const prev = this.smoothState.get(id);
        const smoothed = (prev * factor) + (val * (1.0 - factor));
        this.smoothState.set(id, smoothed);
        return smoothed;
    }

    /**
     * Stabilizes a value using a Median Filter.
     * Great for removing "glitches" or massive spikes (like Ultrasonic sensors).
     * 
     * @param {string} id - Unique ID for this sensor
     * @param {number} val - The raw new value
     * @param {number} frames - How many recent frames to look at (default: 5)
     * @returns {number} The stable (median) value
     */
    stable(id, val, frames = 5) {
        if (!this.stableState.has(id)) {
            this.stableState.set(id, []);
        }

        const buffer = this.stableState.get(id);
        buffer.push(val);

        if (buffer.length > frames) {
            buffer.shift();
        }

        // Return median
        const sorted = [...buffer].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted[mid];
    }

    /**
     * Predicts a value using a Simplified 1D Kalman Filter.
     * Great for tracking moving objects with noisy sensors.
     * 
     * @param {string} id - Unique ID for this sensor
     * @param {number} val - The raw new value
     * @param {number} R - Measurement Noise (default: 1). Higher = Trust sensor less.
     * @param {number} Q - Process Noise (default: 0.1). Higher = Expect more movement.
     * @returns {number} The estimated value
     */
    kalman(id, val, R = 1, Q = 0.1) {
        if (!this.kalmanState.has(id)) {
            // Initial state: [estimate, error_covariance]
            this.kalmanState.set(id, { x: val, p: 1 });
            return val;
        }

        let state = this.kalmanState.get(id);

        // Prediction Phase
        let p_pred = state.p + Q;

        // Update Phase
        let K = p_pred / (p_pred + R); // Kalman Gain
        let x_new = state.x + K * (val - state.x); // New Estimate
        let p_new = (1 - K) * p_pred; // New Covariance

        // Save state
        state.x = x_new;
        state.p = p_new;

        return x_new;
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SerialBridge;
}
