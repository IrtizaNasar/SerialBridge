/**
 * Serial Bridge - Main Process
 * 
 * This file runs the Electron main process and Express server.
 * It handles:
 * - Creating the desktop application window
 * - Running a web server for the UI and API
 * - Managing serial port connections
 * - Broadcasting data via WebSockets (Socket.IO)
 * - Handling Bluetooth device selection
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Enable Web Bluetooth on Linux if not already enabled
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'WebBluetooth');
}

const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const socketIo = require('socket.io');

// Import Notch Manager (Mac Only)
const { initNotch, enableNotch, disableNotch, hasNotch } = require('./notch-manager');

// Import Settings Manager
const { loadSettings, saveSettings, updateSetting } = require('./settings-manager');
const { initialize, trackEvent } = require('@aptabase/electron/main');

// Initialize Aptabase IMMEDIATELY (Before app is ready)
console.log('Initializing Aptabase with key: A-EU-1148008968');
initialize('A-EU-9940066759');

let connections = new Map(); // Stores active serial port connections (id -> {port, parser})
let serverPort = 3000;       // Default server port (will auto-increment if busy)
let bluetoothCallback = null; // Callback for Bluetooth device selection


/**
 * Creates and configures the Express server and Socket.IO
 * This server provides:
 * - The web UI for managing connections
 * - REST API endpoints for serial port operations
 * - WebSocket server for real-time data streaming
 */
function createServer() {
    const expressApp = express();

    // Middleware setup
    expressApp.use(express.json()); // Parse JSON request bodies

    // Enable CORS (Cross-Origin Resource Sharing) for external P5.js projects
    expressApp.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Serve static files from the public directory (HTML, CSS, JS, client library)
    expressApp.use(express.static(path.join(__dirname, 'public')));

    /**
     * API Route: GET /api/ports
     * Returns a list of available serial ports
     * Filters for common Arduino/microcontroller manufacturers
     */
    expressApp.get('/api/ports', async (req, res) => {
        try {
            const ports = await SerialPort.list();

            // Filter for Arduino and common USB-to-serial chips
            const arduinoPorts = ports.filter(port => {
                if (!port.manufacturer) return false;
                const manufacturer = port.manufacturer.toLowerCase();
                return manufacturer.includes('arduino') ||
                    manufacturer.includes('ch340') ||
                    manufacturer.includes('ch341') ||
                    manufacturer.includes('ftdi') ||
                    manufacturer.includes('silicon labs') ||
                    manufacturer.includes('wch.cn');
            });

            res.json({ all: ports, arduino: arduinoPorts });
        } catch (error) {
            console.error('Error listing ports:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * API Route: POST /api/connect
     * Connects to a serial port and starts streaming data
     * 
     * Request body: { id, portPath, baudRate }
     * - id: Unique identifier for this connection (e.g., "device_1")
     * - portPath: Serial port path (e.g., "/dev/tty.usbmodem14101")
     * - baudRate: Communication speed (default: 9600)
     */
    expressApp.post('/api/connect', async (req, res) => {
        const { id, portPath, baudRate = 9600 } = req.body;

        try {
            // Close existing connection if reconnecting
            if (connections.has(id)) {
                const existingConnection = connections.get(id);
                if (existingConnection.port && existingConnection.port.isOpen) {
                    await new Promise(resolve => existingConnection.port.close(resolve));
                }
            }

            // Create new serial port connection
            const serialPort = new SerialPort({
                path: portPath,
                baudRate: parseInt(baudRate),
                autoOpen: false  // We'll open it manually to handle errors better
            });

            // Open the port manually to catch immediate errors (like Access Denied)
            await new Promise((resolve, reject) => {
                serialPort.open((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Create a parser to split incoming data by newlines
            // This ensures we get complete messages, not partial data
            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            // Event: When data arrives from the Arduino
            parser.on('data', (data) => {
                const cleanData = data.trim();
                if (cleanData) {
                    console.log('[DATA] ' + id + ': ' + cleanData);
                    // Broadcast data to all connected web clients via WebSocket
                    io.emit('serial-data', { id, data: cleanData });
                }
            });

            // Event: When the port successfully opens
            serialPort.on('open', () => {
                console.log('[CONNECTED] ' + id + ' on ' + portPath);
                // Notify all clients that this device is now connected
                io.emit('connection-status', { id, status: 'connected', port: portPath });
            });

            // Event: If there's an error with the serial port
            serialPort.on('error', (error) => {
                console.error('[ERROR] Serial error ' + id + ':', error);
                io.emit('connection-status', { id, status: 'disconnected', error: error.message });
                connections.delete(id);
            });

            // Event: When the port closes (device unplugged, etc.)
            serialPort.on('close', () => {
                console.log('[DISCONNECTED] ' + id);
                io.emit('connection-status', { id, status: 'disconnected' });
                connections.delete(id);
            });

            // Store the connection for later reference
            connections.set(id, { port: serialPort, parser });

            // Port is already opened by the await above
            res.json({ success: true });

        } catch (error) {
            console.error('Failed to connect ' + id + ':', error);

            // Check for specific error messages to provide better feedback
            if (error.message && (error.message.includes('Access denied') || error.message.includes('Resource busy'))) {
                res.status(500).json({
                    error: error.message,
                    errorType: 'PORT_BUSY'
                });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    expressApp.post('/api/disconnect', async (req, res) => {
        const { id } = req.body;

        try {
            if (connections.has(id)) {
                const connection = connections.get(id);
                if (connection.port && connection.port.isOpen) {
                    await new Promise(resolve => connection.port.close(resolve));
                }
                connections.delete(id);
                console.log('[DISCONNECTED] Manually disconnected ' + id);
            }
            res.json({ success: true });
        } catch (error) {
            console.error('Failed to disconnect ' + id + ':', error);
            res.status(500).json({ error: error.message });
        }
    });

    expressApp.post('/api/send', (req, res) => {
        const { id, data } = req.body;

        if (connections.has(id)) {
            const connection = connections.get(id);
            if (connection.port && connection.port.isOpen) {
                connection.port.write(data + '\n', (err) => {
                    if (err) {
                        console.error('Failed to send to ' + id + ':', err);
                        res.status(500).json({ error: err.message });
                    } else {
                        console.log('[SENT] ' + id + ': ' + data);
                        res.json({ success: true });
                    }
                });
            } else {
                res.status(400).json({ error: 'Arduino not connected' });
            }
        } else {
            res.status(400).json({ error: 'Arduino connection not found' });
        }
    });

    const httpServer = http.createServer(expressApp);
    io = socketIo(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });


    io.on('connection', (socket) => {
        console.log('Client connected');

        // Send current status to new client
        connections.forEach((connection, id) => {
            socket.emit('connection-status', {
                id: id,
                status: 'connected',
                port: connection.portPath
            });
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });

        // Relay BLE data from Electron renderer to P5.js clients
        socket.on('ble-data', (data) => {
            // Broadcast to all other clients (P5.js sketches)
            // We re-emit it as 'serial-data' so P5 sketches don't need special code
            // They will see it as coming from a device named "BLE_DeviceName"
            io.emit('serial-data', {
                id: data.device, // Use device name as ID
                data: data.data
            });
        });

        // Relay BLE connection status from Electron renderer to P5.js clients
        socket.on('connection-status', (statusData) => {
            // Broadcast status to all clients
            io.emit('connection-status', statusData);
        });
    });

    // Try to start server, with fallback ports if 3000 is busy
    function tryStartServer(port, maxAttempts = 5) {
        httpServer.listen(port, '127.0.0.1')
            .on('listening', () => {
                serverPort = port;
                console.log(`[SERVER] Serial Bridge running on http://localhost:${serverPort}`);
                console.log('[SERVER] WebSocket server ready for P5.js connections');
            })
            .on('error', (err) => {
                if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
                    console.log(`[SERVER] Port ${port} is busy, trying ${port + 1}...`);
                    tryStartServer(port + 1, maxAttempts - 1);
                } else {
                    console.error('[SERVER] Failed to start server:', err);
                    app.quit();
                }
            });
    }

    server = httpServer;
    tryStartServer(serverPort);
}


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 1000,
        webPreferences: {
            nodeIntegration: false, // Security: Disable Node.js integration in renderer
            contextIsolation: true, // Security: Protect against prototype pollution
            webSecurity: true,      // Security: Enforce same-origin policy
            preload: path.join(__dirname, 'preload.js') // Preload script for safe IPC
        },
        title: 'Serial Bridge',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#050505',
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'public/logo.png')
    });

    // Add basic context menu (Copy/Paste/Inspect)
    const { Menu, MenuItem } = require('electron');
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();

        // Add Copy if text is selected
        if (params.selectionText) {
            menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
        }

        // Add Paste if editable
        if (params.isEditable) {
            menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
        }

        // Add Inspect Element for debugging (optional, but helpful)
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
            label: 'Inspect Element',
            click: () => {
                mainWindow.webContents.inspectElement(params.x, params.y);
            }
        }));

        if (menu.items.length > 0) {
            menu.popup();
        }
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Handle Bluetooth device selection
    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        event.preventDefault();
        console.log('Main: select-bluetooth-device triggered. Devices:', deviceList.length);

        // Debug: Log device properties to see what's available
        deviceList.forEach((device, index) => {
            console.log(`Device ${index}:`, {
                deviceName: device.deviceName,
                deviceId: device.deviceId,
                allProperties: Object.keys(device)
            });
        });

        // Update the callback reference
        // We do NOT cancel the previous one here because this event fires multiple times
        // for the SAME scan request as new devices are found.
        bluetoothCallback = callback;

        // Send device list to renderer
        mainWindow.webContents.send('bluetooth-device-list', deviceList);
    });

    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.setMenuBarVisibility(false);
}

// Handle device selection from renderer
ipcMain.on('bluetooth-device-selected', (event, deviceId) => {
    console.log('Main: Device selected:', deviceId);
    if (bluetoothCallback) {
        bluetoothCallback(deviceId);
        bluetoothCallback = null;
    }
});

// Handle cancellation from renderer
ipcMain.on('bluetooth-device-cancelled', () => {
    console.log('Main: Device selection cancelled');
    if (bluetoothCallback) {
        bluetoothCallback(''); // Empty string cancels the selection
        bluetoothCallback = null;
    }
});

// Handle bluetooth pairing request (for Device Profiles)
ipcMain.handle('bluetooth-pairing-request', async (event, serviceUuid) => {
    console.log('Main: Bluetooth pairing request for service:', serviceUuid);

    try {
        // Trigger the Bluetooth device picker
        // The mainWindow.webContents.on('select-bluetooth-device') handler will be called
        // We don't need to do anything here except acknowledge the request
        return { success: true };
    } catch (error) {
        console.error('Main: Error in bluetooth-pairing-request:', error);
        throw error;
    }
});







app.whenReady().then(() => {
    console.log('[DEBUG] App Starting...');

    // Log process crashes (GPU, Renderer, etc.)
    app.on('child-process-gone', (event, details) => {
        console.error('[DEBUG] Child Process Gone:', details.type, details.reason, details.exitCode);
    });

    createServer();
    setTimeout(() => {
        createWindow();
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.on('render-process-gone', (event, details) => {
                console.error('[DEBUG] Renderer Process Gone:', details.reason, details.exitCode);
            });
            mainWindow.webContents.on('crashed', (event) => {
                console.error('[DEBUG] Renderer Crashed');
            });
        }
    }, 1000);

    // Initialize Settings
    const { loadSettings, saveSettings, updateSetting } = require('./settings-manager');
    // Aptabase initialized at top level

    const settings = loadSettings();
    console.log('Analytics Enabled:', settings.analyticsEnabled);

    // Track App Launch if enabled
    if (settings.analyticsEnabled) {
        console.log('Tracking app_started event...');
        trackEvent('app_started', {
            os: process.platform,
            version: app.getVersion(),
            arch: process.arch
        }).then(() => {
            console.log('App Started event sent successfully');
        }).catch(err => {
            console.error('Failed to send App Started event:', err);
        });
    } else {
        console.log('Analytics disabled, skipping app_started event.');
    }

    // Initialize Dynamic Notch (macOS Only)
    initNotch(ipcMain, settings.notchEnabled);

    // Settings IPC Handlers
    ipcMain.handle('get-settings', () => {
        return loadSettings();
    });

    ipcMain.handle('has-notch', () => {
        return hasNotch();
    });

    // Handle Settings Updates
    ipcMain.handle('update-setting', (event, key, value) => {
        try {
            console.log(`[SETTINGS] Updating ${key} to ${value}`);
            const newSettings = updateSetting(key, value);

            // Handle specific side effects
            if (key === 'notchEnabled') {
                if (value) enableNotch();
                else disableNotch();
            }

            if (key === 'analyticsEnabled') {
                if (value) trackEvent('analytics_opt_in');
                else trackEvent('analytics_opt_out');
            }

            // Broadcast new settings to all windows
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('settings-updated', newSettings);
            }

            return newSettings;
        } catch (error) {
            console.error('[SETTINGS] Error updating setting:', error);
            throw error;
        }
    });

    // Handle Analytics Events from Renderer
    ipcMain.handle('track-event', (event, eventName, props) => {
        const settings = loadSettings();
        if (settings.analyticsEnabled) {
            trackEvent(eventName, props);
        }
    });

    // Track App Quit
    // Explicitly close Notch Window on quit to prevent zombies
    app.on('before-quit', () => {
        disableNotch();
        const settings = loadSettings();
        if (settings.analyticsEnabled) {
            trackEvent('app_quit');
        }
    });

    // Global Error Tracking (Main Process)
    process.on('uncaughtException', (error) => {
        const settings = loadSettings();
        if (settings.analyticsEnabled) {
            // Sanitize stack to remove user paths
            const cleanStack = error.stack
                ? error.stack.split('\n')[0].replace(os.homedir(), '~')
                : 'No stack';

            trackEvent('error', {
                process: 'main',
                type: 'uncaughtException',
                message: error.message,
                stack: cleanStack
            });
        }
    });

    process.on('unhandledRejection', (reason) => {
        const settings = loadSettings();
        if (settings.analyticsEnabled) {
            trackEvent('error', {
                process: 'main',
                type: 'unhandledRejection',
                message: reason instanceof Error ? reason.message : String(reason)
            });
        }
    });
});

app.on('window-all-closed', () => {
    connections.forEach((connection, id) => {
        if (connection.port && connection.port.isOpen) {
            connection.port.close();
            console.log('[CLEANUP] Closed ' + id + ' on app quit');
        }
    });

    if (server) {
        server.close();
    }

    app.quit();
});

app.on('before-quit', () => {
    connections.forEach((connection) => {
        if (connection.port && connection.port.isOpen) {
            connection.port.close();
        }
    });
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.

    // Check if the MAIN window is destroyed or missing.
    // We explicitly check mainWindow instead of getAllWindows() to handle cases
    // where auxiliary windows (like the notch or hidden panels) might still exist.

    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
});

