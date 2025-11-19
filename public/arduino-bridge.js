/**
 * Arduino Bridge Client Library
 *
 * A simple client library for connecting P5.js sketches to the Arduino Bridge.
 *
 * Usage:
 *   const bridge = new ArduinoBridge();
 *   // or specify a custom URL/port:
 *   const bridge = new ArduinoBridge('http://localhost:3001');
 *
 *   bridge.onData('arduino_1', (data) => {
 *     console.log('Received:', data);
 *   });
 */

class ArduinoBridge {
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

        this.connect();
    }

    /**
     * Connect to the Arduino Bridge server
     */
    connect() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO not loaded. Please include the Socket.IO client library before arduino-bridge.js');
            return;
        }

        this.socket = io(this.serverUrl);

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('🌉 Connected to Arduino Bridge');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('🔌 Disconnected from Arduino Bridge');
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
     * Register a callback for data from a specific Arduino
     * @param {string} arduinoId - The Arduino ID (e.g., 'arduino_1') or '*' for all
     * @param {function} callback - Function to call when data is received
     */
    onData(arduinoId, callback) {
        if (!this.dataHandlers.has(arduinoId)) {
            this.dataHandlers.set(arduinoId, []);
        }
        this.dataHandlers.get(arduinoId).push(callback);
        return this;
    }

    /**
     * Register a callback for connection status changes
     * @param {string} arduinoId - The Arduino ID (e.g., 'arduino_1') or '*' for all
     * @param {function} callback - Function to call when status changes (status, port, id)
     */
    onStatus(arduinoId, callback) {
        if (!this.statusHandlers.has(arduinoId)) {
            this.statusHandlers.set(arduinoId, []);
        }
        this.statusHandlers.get(arduinoId).push(callback);
        return this;
    }

    /**
     * Send data to a specific Arduino
     * @param {string} arduinoId - The Arduino ID (e.g., 'arduino_1')
     * @param {string} data - Data to send
     */
    async send(arduinoId, data) {
        try {
            const response = await fetch(`${this.serverUrl}/api/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: arduinoId, data: data })
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
     * Connect to an Arduino on a specific port
     * @param {string} arduinoId - The Arduino ID (e.g., 'arduino_1')
     * @param {string} portPath - The port path (e.g., '/dev/cu.usbmodem14101')
     * @param {number} baudRate - Baud rate (default: 9600)
     */
    async connectArduino(arduinoId, portPath, baudRate = 9600) {
        try {
            const response = await fetch(`${this.serverUrl}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: arduinoId, portPath, baudRate })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('Failed to connect Arduino:', error);
            throw error;
        }
    }

    /**
     * Disconnect from an Arduino
     * @param {string} arduinoId - The Arduino ID (e.g., 'arduino_1')
     */
    async disconnectArduino(arduinoId) {
        try {
            const response = await fetch(`${this.serverUrl}/api/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: arduinoId })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('Failed to disconnect Arduino:', error);
            throw error;
        }
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
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArduinoBridge;
}
