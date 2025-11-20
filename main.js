const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const socketIo = require('socket.io');

let mainWindow;
let server;
let io;
let connections = new Map();
let serverPort = 3000;
let bluetoothCallback = null;

function createServer() {
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Serve static files from the public directory
    expressApp.use(express.static(path.join(__dirname, 'public')));

    // API Routes
    expressApp.get('/api/ports', async (req, res) => {
        try {
            const ports = await SerialPort.list();
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

    expressApp.post('/api/connect', async (req, res) => {
        const { id, portPath, baudRate = 9600 } = req.body;

        try {
            if (connections.has(id)) {
                const existingConnection = connections.get(id);
                if (existingConnection.port && existingConnection.port.isOpen) {
                    await new Promise(resolve => existingConnection.port.close(resolve));
                }
            }

            const serialPort = new SerialPort({
                path: portPath,
                baudRate: parseInt(baudRate),
                autoOpen: false
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            parser.on('data', (data) => {
                const cleanData = data.trim();
                if (cleanData) {
                    console.log('[DATA] ' + id + ': ' + cleanData);
                    io.emit('serial-data', { id, data: cleanData });
                }
            });

            serialPort.on('open', () => {
                console.log('[CONNECTED] ' + id + ' on ' + portPath);
                io.emit('connection-status', { id, status: 'connected', port: portPath });
                res.json({ success: true });
            });

            serialPort.on('error', (error) => {
                console.error('[ERROR] Serial error ' + id + ':', error);
                io.emit('connection-status', { id, status: 'disconnected', error: error.message });
                connections.delete(id);
            });

            serialPort.on('close', () => {
                console.log('[DISCONNECTED] ' + id);
                io.emit('connection-status', { id, status: 'disconnected' });
                connections.delete(id);
            });

            connections.set(id, { port: serialPort, parser });
            serialPort.open();

        } catch (error) {
            console.error('Failed to connect ' + id + ':', error);
            res.status(500).json({ error: error.message });
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
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'Serial Bridge',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#050505',
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'public/logo.png')
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
        console.log('Main: bluetoothCallback already exists?', !!bluetoothCallback);

        // Just replace the callback - don't call the old one as it causes a loop
        bluetoothCallback = callback;

        // Send device list to renderer
        mainWindow.webContents.send('bluetooth-device-list', deviceList);
    });

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

    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createServer();
    setTimeout(createWindow, 1000);
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
