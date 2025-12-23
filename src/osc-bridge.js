const { Client, Server } = require('node-osc');

let oscClient = null;
let oscServer = null;
let isEnabled = false;
let currentHost = '127.0.0.1';
let currentPort = 3333; // Send Port
let listeningPort = 3334; // Receive Port
let isFlatteningEnabled = false; // Flatten JSON to individual addresses

// Reference to active connections (passed from main.js)
let activeConnections = null;
let mainWindow = null;

/**
 * Initialize the OSC Bridge with settings
 * @param {Object} settings - Application settings
 * @param {Map} connections - Active serial connections map
 * @param {BrowserWindow} window - Main Electron window
 */
function init(settings, connections, window) {
    activeConnections = connections;
    mainWindow = window;
    updateSettings(settings);
}

function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Update OSC settings and recreate client/server if needed
 * @param {Object} settings 
 */
function updateSettings(settings) {

    const newEnabled = settings.oscEnabled || false;
    const newHost = settings.oscHost || '127.0.0.1';
    const newPort = parseInt(settings.oscPort) || 3333;
    const newReceiveEnabled = settings.oscReceiveEnabled || false;
    const newListeningPort = parseInt(settings.oscReceivePort) || 3334;
    const newFlatteningEnabled = settings.oscFlattening || false;

    // If disabled, close existing client/server
    if (!newEnabled) {
        close();
        isEnabled = false;
        return;
    }

    // If settings changed, recreate client
    // We check if ANY setting changed that requires a restart
    if (!oscClient ||
        newHost !== currentHost ||
        newPort !== currentPort ||
        newListeningPort !== listeningPort ||
        newReceiveEnabled !== (oscServer !== null) || // Check if receive state changed
        newFlatteningEnabled !== isFlatteningEnabled ||
        !isEnabled) {

        close();
        try {

            oscClient = new Client(newHost, newPort);

            if (newReceiveEnabled) {

                try {
                    oscServer = new Server(newListeningPort, '0.0.0.0', () => {
                        console.log(`[OSC] Server listening on ${newListeningPort}`);
                    });

                    oscServer.on('message', (msg) => {
                        handleMessage(msg);
                    });

                    // Handle Server Errors (e.g., Port Busy)
                    if (oscServer._sock) {
                        oscServer._sock.on('error', (err) => {
                            console.error('[OSC] Server Socket Error:', err);
                            if (err.code === 'EADDRINUSE') {
                                sendErrorToClient('receive', newListeningPort, 'Port is already in use');
                            }
                        });
                    }

                } catch (err) {
                    console.error('[OSC] Server Creation Error:', err);
                    if (err.code === 'EADDRINUSE') {
                        sendErrorToClient('receive', newListeningPort, 'Port is already in use');
                    }
                }
            } else {
                console.log('[OSC] Receiving disabled');
            }

            currentHost = newHost;
            currentPort = newPort;
            currentPort = newPort;
            listeningPort = newListeningPort;
            isFlatteningEnabled = newFlatteningEnabled;
            isEnabled = true;
        } catch (err) {
            console.error('[OSC] Failed to initialize client/server:', err);
            isEnabled = false;
        }
    }
}

function sendErrorToClient(type, port, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('osc-error', { type, port, message });
    }
}

/**
 * Handle incoming OSC messages
 * Format: /send <device_id> <message>
 * Example: /send device_1 "LED_ON"
 */
function handleMessage(msg) {
    const address = msg[0];

    if (address === '/send') {
        const deviceId = msg[1];
        const data = msg[2];

        if (activeConnections && activeConnections.has(deviceId)) {
            const conn = activeConnections.get(deviceId);
            if (conn.port && conn.port.isOpen) {

                conn.port.write(String(data) + '\n', (err) => {
                    if (err) console.error(`[OSC-IN] Write error to ${deviceId}:`, err);
                });
            } else {
                console.warn(`[OSC-IN] Device ${deviceId} not connected`);
            }
        } else {
            console.warn(`[OSC-IN] Unknown device ID: ${deviceId}`);
        }
    }
}

/**
 * Broadcast data via OSC
 * @param {string} address - OSC Address (e.g., '/serial')
 * @param {string} id - Device ID
 * @param {any} data - Data payload
 */
function send(address, id, data) {
    if (!isEnabled || !oscClient) return;

    try {
        // Flattened Mode: Recursive Decomposition
        // Deconstructs the object and sends individual messages for each leaf node
        if (isFlatteningEnabled && typeof data === 'object' && data !== null) {
            flattenAndSend(address, id, data);
            return;
        }

        // Standard Mode: Serialized JSON
        let payload = data;
        if (typeof data === 'object') {
            payload = JSON.stringify(data);
        }

        oscClient.send(address, id, payload, (err) => {
            if (err) console.error('[OSC] Send Error:', err);
        });
    } catch (err) {
        console.error('[OSC] Send Exception:', err);
    }
}

/**
 * Recursively flatten object and send individual OSC messages
 * Address format: /serial/device_1/eeg/tp9
 */
function flattenAndSend(baseAddress, id, data, subPath = '') {
    // Append 'type' discriminators to the path (e.g. /eeg, /ppg)
    let currentPath = subPath;

    // Root-level handling
    if (subPath === '') {
        if (data.type) {
            currentPath = '/' + data.type;
        }

        // Bypass metadata wrapper to flatten the primary payload directly
        if (data.data && typeof data.data === 'object') {
            flattenAndSend(baseAddress, id, data.data, currentPath);
            return;
        }
    }

    // Iterate over keys
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            const newPath = currentPath + '/' + key; // e.g. /eeg/tp9

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursive call for nested objects
                flattenAndSend(baseAddress, id, value, newPath);
            } else {
                // Leaf Node: Construct and send full address
                // Pattern: {baseAddress}/{safeId}/{subPath}
                // Example: /serial/device_1/eeg/tp9

                // Sanitize ID and Key to be safe OSC addresses (alphanumeric)
                const safeId = String(id).replace(/[^a-zA-Z0-9_]/g, '_');

                // Construct full address
                // If baseAddress is /serial, result is /serial/device_1/eeg/tp9
                const fullAddress = `${baseAddress}/${safeId}${newPath}`;

                oscClient.send(fullAddress, value, (err) => {
                    if (err) console.error('[OSC] Flatten Send Error:', err);
                });
            }
        }
    }
}

/**
 * Close the OSC client and server
 */
function close() {
    if (oscClient) {
        try {
            oscClient.close();
        } catch (e) {
            console.error('[OSC] Error closing client:', e);
        }
        oscClient = null;
    }
    if (oscServer) {
        try {
            oscServer.close();
        } catch (e) {
            console.error('[OSC] Error closing server:', e);
        }
        oscServer = null;
    }
}

module.exports = {
    init,
    setMainWindow,
    updateSettings,
    send,
    close
};
