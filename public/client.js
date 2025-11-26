/**
 * Serial Bridge - Client UI
 * 
 * This file handles the browser-side user interface for managing connections.
 * It provides:
 * - Connection card creation and management
 * - USB Serial and Bluetooth (BLE) connection UI
 * - Drag-and-drop reordering of connections
 * - Session save/load functionality
 * - Real-time data display
 * 
 * Code Organization:
 * - Setup & Initialization (lines 1-100)
 * - Drag & Drop Logic (lines 100-200)
 * - Bluetooth (BLE) Functions (lines 200-500)
 * - Connection Management (lines 500-900)
 * - UI Helper Functions (lines 900-1200)
 * - Session Management (lines 1200-1400)
 */

(function () {
    console.log('Serial Bridge JavaScript loading...');

    const socket = io();

    // Helper to resize input based on content
    window.resizeInput = function (el) {
        if (!el) return; // Safety check
        // Reset width to min to calculate scrollWidth correctly
        el.style.width = '1ch';
        el.style.width = (el.scrollWidth) + 'px';
    };

    // ===== CONFIGURATION =====
    // BLE UART Service UUIDs (Nordic UART Service standard)
    // BLE UART Service UUIDs (Nordic UART Service standard)
    const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to this
    const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Read from this

    // ===== DEVICE PROFILES =====
    const DEVICE_PROFILES = {
        'generic_uart': {
            name: 'Generic UART (Arduino/ESP32)',
            service: UART_SERVICE_UUID,
            characteristic: UART_TX_CHAR_UUID,
            writeCharacteristic: UART_RX_CHAR_UUID,
            parser: parseGenericUART
        },
        'muse_2': {
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
        }
    };

    // ===== STATE MANAGEMENT =====
    let connections = {};           // Stores all connection data (id -> connection object)
    let scanningConnectionId = null; // Tracks which card is currently scanning for BLE

    // IPC Renderer is exposed via preload.js as window.electron.ipcRenderer
    const ipcRenderer = window.electron ? window.electron.ipcRenderer : null;
    console.log('Client: IPC Renderer available:', !!ipcRenderer);

    document.addEventListener('DOMContentLoaded', () => {
        // BLE Button Handler
        const bleBtn = document.getElementById('connect-ble-btn');
        if (bleBtn) {
            // Change to add a new BLE connection card instead of direct connect
            bleBtn.addEventListener('click', addBLEConnection);
        }

        // Handle BLE Device List from Main Process
        if (ipcRenderer) {
            ipcRenderer.on('bluetooth-device-list', (deviceList) => {
                console.log('Client: Received bluetooth-device-list', deviceList);
                if (scanningConnectionId) {
                    updateBLEDeviceList(scanningConnectionId, deviceList);
                }
            });
        } else {
            console.warn('IPC Renderer not available. BLE selection might fail.');
        }

        // Prevent default context menu, except in code snippets (for copying)
        document.addEventListener('contextmenu', event => {
            if (!event.target.closest('.code-snippet-wrapper')) {
                event.preventDefault();
            }
        });

        // Drag and Drop Container Listeners
        const connectionsDiv = document.getElementById('connections');
        if (connectionsDiv) {
            connectionsDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(connectionsDiv, e.clientY);
                const draggable = document.querySelector('.dragging');
                if (draggable) {
                    if (afterElement == null) {
                        connectionsDiv.appendChild(draggable);
                    } else {
                        connectionsDiv.insertBefore(draggable, afterElement);
                    }

                    // Auto-scrolling logic
                    const scrollArea = document.querySelector('.content-scroll-area');
                    if (scrollArea) {
                        const rect = scrollArea.getBoundingClientRect();
                        const threshold = 100; // Distance from edge to start scrolling
                        const speed = 10; // Scroll speed

                        if (e.clientY < rect.top + threshold) {
                            // Scroll up
                            scrollArea.scrollTop -= speed;
                        } else if (e.clientY > rect.bottom - threshold) {
                            // Scroll down
                            scrollArea.scrollTop += speed;
                        }
                    }
                }
            });
        }
    });

    // Helper to find the element to drop after
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.connection-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ========================================
    // BLUETOOTH (BLE) FUNCTIONS
    // ========================================
    // These functions handle Bluetooth Low Energy device scanning and connection
    // BLE is used for devices like Arduino Uno R4 WiFi that don't create COM ports

    // Track last scan time to prevent rapid re-scanning
    let lastScanTime = 0;
    const SCAN_COOLDOWN = 1000; // 1 second between scans

    // Start scanning for this card
    window.scanBLE = async function (id) {
        console.log('Starting BLE scan for card:', id);

        // Prevent rapid re-scanning which can cause Bluetooth API to hang
        const now = Date.now();
        if (now - lastScanTime < SCAN_COOLDOWN) {
            console.log('Scan cooldown active, please wait...');
            return;
        }
        lastScanTime = now;

        // Reset any previous scanning state
        if (scanningConnectionId && scanningConnectionId !== id) {
            console.warn('Another card was scanning, cancelling it first');
            if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
            // Wait a bit for cancellation to process
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        scanningConnectionId = id;
        const scanBtn = document.getElementById('scan_' + id);
        const select = document.getElementById('ble_device_' + id);

        if (scanBtn) {
            scanBtn.textContent = 'Scanning...';
            scanBtn.disabled = true; // Disable button during scan
        }
        if (select) {
            select.innerHTML = '<option>Scanning...</option>';
            select.disabled = true;
        }

        try {
            console.log('Calling navigator.bluetooth.requestDevice...');

            // Get selected profile to determine service UUID
            const profileSelect = document.getElementById('ble_profile_' + id);
            const profileKey = profileSelect ? profileSelect.value : 'generic_uart';
            const profile = DEVICE_PROFILES[profileKey];

            console.log(`Scanning for profile: ${profile.name} (Service: ${profile.service})`);

            // Request device - this will trigger the IPC flow
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [profile.service] }],
                optionalServices: [profile.service]
            });

            console.log('Device selected:', device.name);
            // If we get here, a device was selected via finalizeBLEConnection
            await setupBLEDevice(device, id);

        } catch (error) {
            console.log('Scan cancelled or failed:', error);

            // Check if it's because no devices were found
            const errorMsg = error.toString();
            if (errorMsg.includes('cancelled') || errorMsg.includes('cancel')) {
                if (scanBtn) scanBtn.textContent = 'Scan';
                if (select) {
                    select.innerHTML = '<option value="">No devices found. Make sure your Arduino is powered on and running the BLE sketch.</option>';
                    select.disabled = false;
                }
            } else {
                if (scanBtn) scanBtn.textContent = 'Scan';
                if (select) {
                    select.innerHTML = '<option>Scan failed: ' + error.message + '</option>';
                    select.disabled = false;
                }
            }

            // Make sure to send cancellation to main process
            if (ipcRenderer && error.name !== 'NotFoundError') {
                ipcRenderer.send('bluetooth-device-cancelled');
            }
        } finally {
            console.log('Scan complete, resetting scanningConnectionId');
            scanningConnectionId = null;
            if (scanBtn) scanBtn.disabled = false; // Re-enable scan button
        }
    };

    // Update the dropdown with found devices
    // Only updates if the device list has actually changed to prevent interrupting user selection
    function updateBLEDeviceList(id, deviceList) {
        const select = document.getElementById('ble_device_' + id);
        const connectBtn = document.getElementById('connect_' + id);

        if (!select) return;

        // Check if the list has changed by comparing device IDs
        const currentOptions = Array.from(select.options)
            .filter(opt => opt.value !== '') // Exclude placeholder
            .map(opt => opt.value);

        const newDeviceIds = deviceList.map(d => d.deviceId);

        // If the lists are the same, don't update (prevents interrupting user selection)
        if (currentOptions.length === newDeviceIds.length &&
            currentOptions.every(id => newDeviceIds.includes(id))) {
            console.log('Device list unchanged, skipping update');
            return;
        }

        // Preserve current selection
        const currentSelection = select.value;

        select.disabled = false;
        select.innerHTML = '';

        if (deviceList.length === 0) {
            const option = document.createElement('option');
            option.text = "No devices found";
            select.add(option);
            if (connectBtn) connectBtn.disabled = true;
        } else {
            // Add placeholder
            const placeholder = document.createElement('option');
            placeholder.text = "Select a device...";
            placeholder.value = "";
            select.add(placeholder);

            let selectionFound = false;
            deviceList.forEach(device => {
                // Debug: Log what we're receiving
                // console.log('Client: Processing device:', device);

                const option = document.createElement('option');
                option.value = device.deviceId;

                // Show MAC address to help distinguish devices with same name
                // Extract last 5 chars of MAC for brevity (e.g., "20:BF")
                const macSuffix = device.deviceId.slice(-5);
                option.text = `${device.deviceName} (${macSuffix})`;

                select.add(option);

                if (device.deviceId === currentSelection) {
                    selectionFound = true;
                }
            });

            // Restore selection if it still exists
            if (selectionFound) {
                select.value = currentSelection;
                if (connectBtn) connectBtn.disabled = false;
            } else {
                if (connectBtn) connectBtn.disabled = true;
            }

            // Enable connect button if user selects something
            select.onchange = () => {
                if (connectBtn) connectBtn.disabled = select.value === "";
            };
        }

        const scanBtn = document.getElementById('scan_' + id);
        if (scanBtn) scanBtn.textContent = 'Rescan';
    }

    // User clicked Connect - send selection to Main
    window.finalizeBLEConnection = function (id) {
        const select = document.getElementById('ble_device_' + id);
        const deviceId = select.value;

        if (deviceId && ipcRenderer) {
            const connectBtn = document.getElementById('connect_' + id);
            if (connectBtn) {
                connectBtn.textContent = 'Connecting...';
                connectBtn.disabled = true;
            }

            // This will cause the await navigator.bluetooth.requestDevice to resolve
            ipcRenderer.send('bluetooth-device-selected', deviceId);
        }
    };

    // Handle disconnection event
    function handleDisconnect(event) {
        const device = event.target;
        console.log('Device ' + device.name + ' disconnected');

        // Find connection ID
        let connectionId = null;
        for (const [id, conn] of Object.entries(connections)) {
            if (conn.type === 'ble' && conn.device === device) {
                connectionId = id;
                break;
            }
        }

        if (connectionId) {
            // Clear Keep-Alive Interval
            if (connections[connectionId].keepAliveInterval) {
                console.log('Clearing Keep-Alive interval for', connectionId);
                clearInterval(connections[connectionId].keepAliveInterval);
                connections[connectionId].keepAliveInterval = null;
            }

            updateBLEUIStatus(connectionId, 'disconnected');
            if (connections[connectionId]) {
                connections[connectionId].status = 'disconnected';
            }

            // Emit status to Socket.IO for p5.js and other clients
            socket.emit('connection-status', {
                id: connectionId,
                status: 'disconnected'
            });
        }
    }

    async function setupBLEDevice(device, targetId = null) {
        console.log('Connecting to GATT Server for ' + device.name + '...');

        // Remove existing listener if any (to avoid duplicates on reconnect)
        device.removeEventListener('gattserverdisconnected', handleDisconnect);
        device.addEventListener('gattserverdisconnected', handleDisconnect);

        try {
            // Ensure clean state
            if (device.gatt.connected) {
                console.log('Device already connected, disconnecting first...');
                device.gatt.disconnect();
                // Wait for disconnect to complete
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Add timeout for connection
            const connectPromise = device.gatt.connect();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timed out')), 10000)
            );

            const server = await Promise.race([connectPromise, timeoutPromise]);

            // Add a delay to ensure connection is stable before getting services
            // Increased to 1500ms to fix "GATT Service no longer exists"
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Get selected profile
            let profileKey;
            if (targetId && connections[targetId] && connections[targetId].profile) {
                console.log('Using stored profile for reconnection:', connections[targetId].profile);
                profileKey = connections[targetId].profile;
            } else {
                const profileSelect = document.getElementById('ble_profile_' + targetId);
                profileKey = profileSelect ? profileSelect.value : 'generic_uart';
            }
            const profile = DEVICE_PROFILES[profileKey];

            console.log(`Connecting using profile: ${profile.name}`);

            console.log('Getting Service...');
            let service;
            try {
                service = await server.getPrimaryService(profile.service);
            } catch (err) {
                console.warn('First attempt to get service failed, retrying...', err);
                await new Promise(resolve => setTimeout(resolve, 1000));
                service = await server.getPrimaryService(profile.service);
            }

            console.log('Getting Characteristics...');

            if (profile.characteristics) {
                // Multi-characteristic support (Muse 2)
                for (const [uuid, type] of Object.entries(profile.characteristics)) {
                    console.log(`Subscribing to ${type} (${uuid})...`);
                    try {
                        const char = await service.getCharacteristic(uuid);
                        await char.startNotifications();
                        char.addEventListener('characteristicvaluechanged', (event) => {
                            handleBLEData(event, targetId, type);
                        });
                    } catch (e) {
                        console.warn(`Failed to subscribe to ${type}:`, e);
                    }
                }
            } else {
                // Single characteristic support (Generic UART)
                const txChar = await service.getCharacteristic(profile.characteristic);
                await txChar.startNotifications();
                txChar.addEventListener('characteristicvaluechanged', (event) => {
                    handleBLEData(event, targetId);
                });
            }

            // Special handling for Muse 2: Send start command
            if (profile.controlCharacteristic) {
                console.log('Muse 2: Getting Control Characteristic...');
                const controlChar = await service.getCharacteristic(profile.controlCharacteristic);
                console.log('Muse 2: Sending Start Command (d) with length prefix...');
                // Command: <length> <char> <newline>
                // 0x02 = length of "d\n"
                // 0x64 = 'd'
                // 0x0a = '\n'
                const command = new Uint8Array([0x02, 0x64, 0x0a]);
                await controlChar.writeValue(command);
                console.log('Muse 2: Start Command Sent!');

                // Keep-Alive Mechanism
                // Read control char every 60 seconds to prevent idle disconnect (Passive)
                if (targetId && connections[targetId]) {
                    console.log('Muse 2: Starting Optimized Keep-Alive interval (60s)...');
                    connections[targetId].keepAliveInterval = setInterval(async () => {
                        if (connections[targetId] && connections[targetId].status === 'connected' && controlChar) {
                            try {
                                // Just read the value to keep connection active without sending data
                                await controlChar.readValue();
                                // console.log('Muse 2: Keep-Alive read success');
                            } catch (e) {
                                console.warn('Muse 2: Keep-Alive failed', e);
                            }
                        } else {
                            // Stop if disconnected
                            if (connections[targetId] && connections[targetId].keepAliveInterval) {
                                clearInterval(connections[targetId].keepAliveInterval);
                            }
                        }
                    }, 60000);
                }
            }

            // Store profile parser in the connection object for use in handleBLEData
            if (targetId && connections[targetId]) {
                connections[targetId].profile = profileKey;
                connections[targetId].parser = profile.parser;
            }

            // Listener added above based on profile type

            console.log('BLE Connected!');

            // If we have a target ID (from the setup card), use it
            if (targetId && connections[targetId]) {
                console.log('Finalizing connection for ID:', targetId);
                connections[targetId].status = 'connected';
                connections[targetId].device = device;
                connections[targetId].name = device.name;

                // Emit status to Socket.IO for p5.js and other clients
                socket.emit('connection-status', {
                    id: targetId,
                    status: 'connected',
                    port: device.name
                });

                // Update the existing card UI
                updateBLEUIStatus(targetId, 'connected');

                // Update the name field
                const card = document.getElementById('card_' + targetId);
                if (card) {
                    // Replace the dropdown with a text input for name
                    const formGroup = card.querySelector('.form-group');
                    if (formGroup) {
                        formGroup.innerHTML = `
                        <label class="form-label">Device Name</label>
                        <input type="text" class="form-control" value="${device.name}" disabled style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
                    `;
                    }

                    // Update buttons - remove Scan, ensure Disconnect/Remove are there
                    const btnRow = card.querySelector('.button-row');
                    if (btnRow) {
                        btnRow.innerHTML = `
                        <button class="btn btn-danger" onclick="window.disconnectBLE('${targetId}')" id="connect_${targetId}">Disconnect</button>
                        <button class="btn btn-danger" onclick="window.removeBLE('${targetId}')">Remove</button>
                    `;
                    }

                    // Activate data preview
                    const dataPreview = document.getElementById('data_' + targetId);
                    if (dataPreview) {
                        dataPreview.classList.add('active');
                        dataPreview.innerHTML = '<div class="data-line">Connected! Waiting for data...</div>';
                    }
                }

            } else {
                // Fallback for reconnection or direct calls (legacy)
                // Check if this device is already in our connections list (reconnection scenario)
                let existingId = null;
                for (const [id, conn] of Object.entries(connections)) {
                    if (conn.type === 'ble' && conn.device && conn.device.id === device.id) {
                        existingId = id;
                        break;
                    }
                }

                if (existingId) {
                    // Update existing connection
                    console.log('Restoring existing connection', existingId);
                    updateBLEUIStatus(existingId, 'connected');
                    connections[existingId].status = 'connected';
                    connections[existingId].device = device;
                } else {
                    // Should not happen in new flow, but safe fallback
                    const id = getNextAvailableId();
                    connections[id] = {
                        status: 'connected',
                        type: 'ble',
                        device: device,
                        name: device.name
                    };
                    // This function is now deprecated in favor of addBLEConnection and setupBLEDevice's targetId logic
                    // addBLEToUI(id, device.name);
                }
            }
        } catch (error) {
            console.error('BLE Connection Error:', error);
            if (targetId) {
                const connectBtn = document.getElementById('connect_' + targetId);
                if (connectBtn) {
                    connectBtn.textContent = 'Connect';
                    connectBtn.disabled = false;
                }
                alert('Connection failed: ' + error.message);
            }
        }
    }

    // ===== DATA PARSERS =====
    // Parse Generic UART data (text-based)
    function parseGenericUART(dataView) {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(dataView);
    }

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

        // Helper to unpack 12-bit samples from a 3-byte block
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

    function handleBLEData(event, connectionId, type = null) {
        const value = event.target.value;
        // console.log(`BLE Data received for ${connectionId}`, value);

        // Get the connection and its parser
        const connection = connections[connectionId];
        if (!connection || !connection.parser) {
            // console.warn('No parser found for connection:', connectionId);
            return;
        }

        // Use the connection's parser to decode the data
        const parsedData = connection.parser(value, type);

        if (parsedData === null) {
            // Parser returned null (invalid/incomplete packet)
            console.warn('Parser returned null for data');
            return;
        }

        // Forward to socket
        socket.emit('ble-data', { device: connectionId, data: parsedData });

        // Update UI using standard function
        displaySerialData(connectionId, parsedData);
    }

    function addBLEToUI(id, name) {
        const container = document.getElementById('connections');
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        const displayNum = getDisplayNumber(id);
        const div = document.createElement('div');
        div.className = 'connection-card';
        div.id = 'card_' + id;

        div.innerHTML = `
        <div class="card-header">
            <div class="card-title">
                <h3>Arduino ${displayNum} (BLE)</h3>
                <div class="connection-id-group">
                    <label class="id-label">ID:</label>
                    <input type="text" class="connection-id-input" id="id_input_${id}" value="${id}" disabled>
                    <button class="btn-edit-id" onclick="window.editConnectionId('${id}')" title="Edit Connection ID">Edit</button>
                </div>
            </div>
            <div class="status-badge status-connected" id="status_${id}">
                <div class="status-dot"></div>
                Connected
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Device Name</label>
            <input type="text" class="form-control" value="${name}" disabled style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;">
        </div>

        <div class="button-row">
            <button class="btn btn-danger" onclick="window.disconnectBLE('${id}')" id="connect_${id}">Disconnect</button>
            <button class="btn btn-danger" onclick="window.removeBLE('${id}')">Remove</button>
        </div>

        <div class="data-preview active" id="data_${id}">
            <div class="data-line">Waiting for data...</div>
        </div>
    `;
        container.prepend(div);
    }

    window.disconnectBLE = function (id) {
        const conn = connections[id];

        // Clear Keep-Alive Interval if exists
        if (conn && conn.keepAliveInterval) {
            console.log('Clearing Keep-Alive interval for', id);
            clearInterval(conn.keepAliveInterval);
            conn.keepAliveInterval = null;
        }

        if (conn && conn.device && conn.device.gatt.connected) {
            try {
                conn.device.gatt.disconnect();
            } catch (e) {
                console.warn('Error disconnecting BLE:', e);
            }
        }
        // Always update UI to disconnected state
        updateBLEUIStatus(id, 'disconnected');
        if (conn) conn.status = 'disconnected';
    };

    function updateBLEUIStatus(id, status) {
        const statusEl = document.getElementById('status_' + id);
        const btn = document.getElementById('connect_' + id);

        if (statusEl) {
            if (status === 'connected') {
                statusEl.className = 'status-badge status-connected';
                statusEl.innerHTML = '<div class="status-dot"></div>Connected';
            } else {
                statusEl.className = 'status-badge status-disconnected';
                statusEl.innerHTML = '<div class="status-dot"></div>Disconnected';
            }
        }

        if (btn) {
            if (status === 'connected') {
                btn.textContent = 'Disconnect';
                // Use setAttribute to be consistent with updateConnectionId and ensure DOM reflects state
                btn.setAttribute('onclick', `window.disconnectBLE('${id}')`);
                btn.className = 'btn btn-danger';
                btn.disabled = false;
            } else {
                btn.textContent = 'Reconnect';
                btn.setAttribute('onclick', `window.reconnectBLE('${id}')`);
                btn.className = 'btn btn-primary';
                btn.disabled = false;
            }
        }
    }

    window.reconnectBLE = async function (id) {
        const conn = connections[id];
        if (conn && conn.device) {
            try {
                const btn = document.getElementById('connect_' + id);
                if (btn) {
                    btn.textContent = 'Connecting...';
                    btn.disabled = true;
                }

                await setupBLEDevice(conn.device, id);

            } catch (error) {
                console.error('Reconnection failed:', error);
                alert('Reconnection failed: ' + error);
                updateBLEUIStatus(id, 'disconnected');
            }
        } else {
            alert('Device information lost. Please remove and add again.');
        }
    };

    // Start BLE Scan
    window.scanBLE = async function (id) {
        console.log('scanBLE called for:', id);

        // Prevent rapid re-scanning which can cause Bluetooth API to hang
        const now = Date.now();
        if (now - lastScanTime < SCAN_COOLDOWN) {
            console.log('Scan cooldown active, please wait...');
            return;
        }
        lastScanTime = now;

        // Cancel any existing scan for this card or others
        if (scanningConnectionId) {
            console.log('Cancelling active scan for', scanningConnectionId);
            if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
            // Wait a bit for cancellation to process
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        scanningConnectionId = id;
        const scanBtn = document.getElementById('scan_' + id);
        const select = document.getElementById('ble_device_' + id);
        const profileSelect = document.getElementById('ble_profile_' + id);

        if (scanBtn) {
            scanBtn.textContent = 'Scanning...';
            scanBtn.className = 'btn'; // Reset class
            scanBtn.disabled = false; // Keep enabled so user can click to Rescan
        }
        if (select) {
            select.innerHTML = '<option>Scanning...</option>';
            select.disabled = true;
        }

        // Get selected profile
        const profileKey = profileSelect ? profileSelect.value : 'generic_uart';
        const profile = DEVICE_PROFILES[profileKey];

        console.log(`Scanning for profile: ${profile.name} (Service: ${profile.service})`);

        try {
            console.log('Calling navigator.bluetooth.requestDevice...');

            // Request device - this will trigger the native Bluetooth picker
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [profile.service] }],
                optionalServices: [profile.service]
            });

            console.log('Device selected:', device.name);

            // Device was selected, now connect to it
            await setupBLEDevice(device, id);

        } catch (error) {
            console.error('BLE Scan Error:', error);

            // Don't show alert for user cancellation
            if (error.name !== 'NotFoundError' && error.name !== 'NotAllowedError' && !error.message.includes('User cancelled')) {
                alert('Error scanning for devices: ' + error.message);
            }

            // Make sure to send cancellation to main process
            if (ipcRenderer && error.name !== 'NotFoundError') {
                ipcRenderer.send('bluetooth-device-cancelled');
            }
        } finally {
            console.log('Scan complete, resetting scanningConnectionId');
            scanningConnectionId = null;
            if (scanBtn) {
                scanBtn.disabled = false; // Re-enable scan button

                // Reset button text based on whether devices were found
                const select = document.getElementById('ble_device_' + id);
                if (select && select.options.length > 1) {
                    scanBtn.textContent = 'Rescan';
                } else {
                    scanBtn.textContent = 'Scan';
                }
            }
        }
    };

    window.removeBLE = function (id) {
        console.log('Removing BLE connection:', id);

        // If this card was scanning, cancel the scan
        if (scanningConnectionId === id) {
            console.log('Cancelling active scan for', id);
            if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
            scanningConnectionId = null;
        }

        // Attempt disconnect first
        window.disconnectBLE(id);

        // Remove from connections
        if (connections[id]) {
            delete connections[id];
            console.log('Deleted connection ' + id + ' from map. Remaining keys:', Object.keys(connections));
        } else {
            console.warn('Connection ' + id + ' not found in map during remove');
        }

        // Remove from UI
        const card = document.getElementById('card_' + id);
        if (card) card.remove();

        // Check empty state
        if (Object.keys(connections).length === 0) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = ''; // Clear inline style to let CSS take over
        }
    };
    // Move connections object to top scope if not already there, or ensure it's not overwritten

    // Display server URL in the sidebar and usage instructions
    const serverUrl = window.location.origin;
    const serverUrlElement = document.getElementById('server-url');
    if (serverUrlElement) {
        serverUrlElement.textContent = serverUrl;
    }

    // Update Socket.IO URL in the usage snippet
    const socketioUrlElement = document.getElementById('socketio-url');
    if (socketioUrlElement) {
        socketioUrlElement.textContent = serverUrl;
    }

    // Update all dynamic server URL spans
    const dynamicUrlElements = document.querySelectorAll('.dynamic-server-url');
    dynamicUrlElements.forEach(el => {
        el.textContent = serverUrl;
    });

    socket.on('connection-status', function (data) {
        console.log('Connection status update:', data);
        updateConnectionStatus(data.id, data.status, data.port);
    });

    socket.on('serial-data', function (data) {
        // console.log('Serial data received:', data);
        displaySerialData(data.id, data.data);
    });

    // Get the next available ID using lowest-available logic
    function getNextAvailableId() {
        let num = 1;
        while (connections.hasOwnProperty('device_' + num)) {
            num++;
        }
        return 'device_' + num;
    }

    // Calculate the display number for the Device
    function getDisplayNumber(id) {
        const match = id.match(/^device_(\d+)$/);
        return match ? match[1] : id;
    }

    // Also fix updateConnectionId to handle BLE renames properly
    window.updateConnectionId = function (oldId, newId) {
        newId = newId.trim();

        // Validation
        if (!newId) {
            alert('ID cannot be empty');
            return false;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(newId)) {
            alert('ID can only contain letters, numbers, and underscores');
            return false;
        }

        if (newId === oldId) {
            return true; // No change needed
        }

        if (connections.hasOwnProperty(newId)) {
            alert('ID "' + newId + '" is already in use');
            return false;
        }

        // Check if connected - don't allow renaming while connected
        // For BLE, we allowed disconnecting via UI, so status should be 'disconnected'
        if (connections[oldId] && connections[oldId].status === 'connected') {
            alert('Cannot rename while connected. Disconnect first.');
            return false;
        }

        // Update the connection data
        connections[newId] = connections[oldId];
        delete connections[oldId];

        // Update DOM elements IDs
        const card = document.getElementById('card_' + oldId);
        if (card) card.id = 'card_' + newId;

        const statusEl = document.getElementById('status_' + oldId);
        if (statusEl) statusEl.id = 'status_' + newId;

        // Update specific BLE elements if they exist
        const idInput = document.getElementById('id_input_' + oldId);
        if (idInput) {
            idInput.id = 'id_input_' + newId;
            idInput.value = newId; // Update value too
            window.resizeInput(idInput); // Trigger resize
        }

        const connectBtn = document.getElementById('connect_' + oldId);
        if (connectBtn) {
            connectBtn.id = 'connect_' + newId;
            // Update onclick handler for BLE
            if (connections[newId].type === 'ble') {
                // Re-bind the correct function based on status
                if (connections[newId].status === 'connected') {
                    connectBtn.setAttribute('onclick', `window.disconnectBLE('${newId}')`);
                } else {
                    connectBtn.setAttribute('onclick', `window.reconnectBLE('${newId}')`);
                }
            }
        }

        // Update Remove Button (handles both BLE and Serial)
        const removeBtn = card ? card.querySelector('.btn-remove, [onclick*="removeBLE"], [onclick*="removeConnection"]') : null;
        if (removeBtn) {
            if (connections[newId].type === 'ble') {
                removeBtn.setAttribute('onclick', `window.removeBLE('${newId}')`);
            } else {
                removeBtn.setAttribute('onclick', `window.removeConnection('${newId}')`);
            }
        }

        const editBtn = card ? card.querySelector('[onclick*="editConnectionId"]') : null;
        if (editBtn) {
            editBtn.setAttribute('onclick', `window.editConnectionId('${newId}')`);
        }

        // Update ID group container click handler
        const idGroup = card ? card.querySelector('.connection-id-group') : null;
        if (idGroup) {
            idGroup.setAttribute('onclick', `window.editConnectionId('${newId}')`);
        }

        // Update collapse button
        const collapseBtn = card ? card.querySelector('.btn-collapse') : null;
        if (collapseBtn) {
            collapseBtn.setAttribute('onclick', `window.toggleCard('${newId}')`);
        }

        const dataPreview = document.getElementById('data_' + oldId);
        if (dataPreview) dataPreview.id = 'data_' + newId;

        // For standard serial ports
        const portSelect = document.getElementById('port_' + oldId);
        if (portSelect) {
            portSelect.id = 'port_' + newId;
            portSelect.setAttribute('name', 'port_' + newId);
        }

        // Update Content Wrapper and Toggles
        const contentWrapper = document.getElementById('content_wrapper_' + oldId);
        if (contentWrapper) contentWrapper.id = 'content_wrapper_' + newId;

        const toggleSerial = document.getElementById('toggle_serial_' + oldId);
        if (toggleSerial) {
            toggleSerial.id = 'toggle_serial_' + newId;
            toggleSerial.setAttribute('onclick', `window.toggleConnectionType('${newId}', 'serial')`);
        }

        const toggleBle = document.getElementById('toggle_ble_' + oldId);
        if (toggleBle) {
            toggleBle.id = 'toggle_ble_' + newId;
            toggleBle.setAttribute('onclick', `window.toggleConnectionType('${newId}', 'ble')`);
        }

        const contentDiv = document.getElementById('content_' + oldId);
        if (contentDiv) contentDiv.id = 'content_' + newId;

        // Update BLE Profile Select
        const profileSelect = document.getElementById('ble_profile_' + oldId);
        if (profileSelect) {
            profileSelect.id = 'ble_profile_' + newId;
            profileSelect.setAttribute('onchange', `window.handleProfileChange('${newId}')`);
        }

        // Update Serial specific elements
        if (connections[newId].type !== 'ble') {
            const refreshBtn = card.querySelector('[onclick*="refreshPorts"]');
            if (refreshBtn) refreshBtn.setAttribute('onclick', 'window.refreshPorts(\'' + newId + '\')');

            const toggleBtn = card.querySelector('[onclick*="toggleConnection"]');
            if (toggleBtn) toggleBtn.setAttribute('onclick', 'window.toggleConnection(\'' + newId + '\')');

            const baudSelect = document.getElementById('baud_' + oldId);
            if (baudSelect) baudSelect.id = 'baud_' + newId;
        }

        // Update Pause Button
        const pauseBtn = document.getElementById('pause_' + oldId);
        if (pauseBtn) {
            pauseBtn.id = 'pause_' + newId;
            pauseBtn.setAttribute('onclick', `window.togglePause('${newId}')`);
        }

        console.log('Renamed connection from ' + oldId + ' to ' + newId);
        return true;
    };


    // Enable editing of connection ID
    window.editConnectionId = function (id) {
        const idInput = document.getElementById('id_input_' + id);
        const oldValue = idInput.value;

        // Add editing class to container
        const container = idInput.closest('.connection-id-group');
        if (container) container.classList.add('editing');

        idInput.disabled = false;
        idInput.focus();
        idInput.select();

        // Handle Enter key to save - Delegate to blur to avoid double-fire
        idInput.onkeydown = function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                idInput.blur(); // This will trigger onblur
            } else if (e.key === 'Escape') {
                idInput.value = oldValue;
                idInput.disabled = true;

                // Remove editing class from container
                const container = idInput.closest('.connection-id-group');
                if (container) container.classList.remove('editing');

                // Clear handlers
                idInput.onkeydown = null;
                idInput.onblur = null;
            }
        };

        // Handle blur (click away) to save
        idInput.onblur = function () {
            const newValue = idInput.value;
            if (newValue !== oldValue) {
                if (!window.updateConnectionId(id, newValue)) {
                    idInput.value = oldValue;
                }
            }
            idInput.disabled = true;

            // Remove editing class from container
            const container = idInput.closest('.connection-id-group');
            if (container) container.classList.remove('editing');

            // Clear handlers to prevent memory leaks or weird states
            idInput.onkeydown = null;
            idInput.onblur = null;
        };
    };

    // ========================================
    // CONNECTION MANAGEMENT
    // ========================================
    // These functions handle creating, updating, and removing connection cards

    /**
     * Creates a new connection card
     * This is called when the user clicks "+ New Connection"
     * By default, creates a USB Serial connection
     */
    window.addConnection = function () {
        console.log('Adding new connection...');

        const id = getNextAvailableId();
        const displayNum = getDisplayNumber(id);
        // Default to serial, with a default name
        connections[id] = {
            status: 'disconnected',
            type: 'serial',
            port: null,
            name: `Serial Device ${displayNum}`
        };

        console.log('Created connection with ID:', id);

        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        const connectionsDiv = document.getElementById('connections');
        if (!connectionsDiv) {
            console.error('Connections container not found!');
            return;
        }

        const connectionCard = document.createElement('div');
        connectionCard.className = 'connection-card';
        connectionCard.id = 'card_' + id;
        connectionCard.setAttribute('draggable', 'true');

        // Drag Events
        connectionCard.addEventListener('dragstart', () => {
            // Use setTimeout to ensure the drag image is created from the full opacity element
            // before we apply the dragging class to dim it in the DOM
            setTimeout(() => {
                connectionCard.classList.add('dragging');
            }, 0);
        });

        connectionCard.addEventListener('dragend', () => {
            connectionCard.classList.remove('dragging');
        });

        const isConnected = connections[id].status === 'connected';
        const statusClass = isConnected ? 'status-connected' : 'status-disconnected';
        const statusText = isConnected ? 'Connected' : 'Disconnected';

        // Common Header
        let html = `
            <div class="card-header">
                <div class="card-title">
                    <input type="text" class="card-title-input" value="${connections[id].name}" onchange="window.updateConnectionName('${id}', this.value)">
                    <div class="connection-id-group" onclick="window.editConnectionId('${id}')" title="Click to Edit ID">
                        <label class="id-label">ID:</label>
                        <input type="text" 
                               class="connection-id-input" 
                               id="id_input_${id}" 
                               value="${id}" 
                               disabled
                               oninput="window.resizeInput(this)">
                        <button class="btn-edit-id">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-controls">
                    <div class="status-badge status-disconnected" id="status_${id}">
                        <div class="status-dot"></div>
                        Disconnected
                    </div>
                    <button class="btn-collapse" onclick="window.toggleCard('${id}')" title="Collapse/Expand">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="card-content" id="content_wrapper_${id}">
                <!-- Type Toggle -->
                <div class="connection-type-toggle">
                    <div class="toggle-option active" id="toggle_serial_${id}" onclick="window.toggleConnectionType('${id}', 'serial')">USB</div>
                    <div class="toggle-option" id="toggle_ble_${id}" onclick="window.toggleConnectionType('${id}', 'ble')">Bluetooth</div>
                </div>

                <!-- Dynamic Content Area -->
                <div id="content_${id}">
                    ${getSerialFormHtml(id)}
                </div>
            </div>
        `;

        connectionCard.innerHTML = html;
        connectionsDiv.appendChild(connectionCard);

        // Initialize input width
        const idInput = document.getElementById('id_input_' + id);
        if (idInput) window.resizeInput(idInput);

        // Populate the form with serial content by default
        const contentDiv = document.getElementById('content_' + id);
        if (contentDiv) {
            contentDiv.innerHTML = getSerialFormHtml(id);
        }

        // Automatically refresh ports for serial connections
        // Use setTimeout to ensure DOM elements are fully rendered
        setTimeout(() => {
            window.refreshPorts(id);
        }, 100);

        // Update connection counts
        window.updateConnectionCounts();

        console.log('Connection card added to DOM');
    };

    window.updateConnectionName = function (id, newName) {
        if (connections[id]) {
            connections[id].name = newName;
            console.log(`Updated name for ${id} to ${newName}`);
        }
    };

    window.toggleConnectionType = function (id, type) {
        if (!connections[id]) return;

        // If already connected, warn user
        if (connections[id].status === 'connected') {
            if (!confirm('Switching connection type will disconnect the current device. Continue?')) {
                return;
            }
            // Disconnect first
            if (connections[id].type === 'ble') {
                window.disconnectBLE(id);
            } else {
                // For serial, we don't have a disconnect function exposed yet, but we can just reset state
                // In a real app, we'd call window.disconnectSerial(id)
                connections[id].status = 'disconnected';
                updateConnectionStatus(id, 'disconnected');
            }
        }

        connections[id].type = type;
        console.log(`Switched connection ${id} to ${type}`);

        // Update Toggle UI
        const serialToggle = document.getElementById(`toggle_serial_${id}`);
        const bleToggle = document.getElementById(`toggle_ble_${id}`);

        if (type === 'serial') {
            serialToggle.classList.add('active');
            bleToggle.classList.remove('active');
        } else {
            serialToggle.classList.remove('active');
            bleToggle.classList.add('active');
        }

        // Update Content
        const contentDiv = document.getElementById(`content_${id}`);
        if (contentDiv) {
            if (type === 'serial') {
                contentDiv.innerHTML = getSerialFormHtml(id);
                // Automatically refresh ports when switching to serial
                setTimeout(() => {
                    window.refreshPorts(id);
                }, 100);
            } else {
                contentDiv.innerHTML = getBLEFormHtml(id);
            }
        }

        // Update connection counts
        window.updateConnectionCounts();
    };

    function getSerialFormHtml(id) {
        return `
            <div class="form-group">
                <label class="form-label" for="port_${id}">Serial Port</label>
                <select class="form-select" id="port_${id}">
                    <option value="">Select port...</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" for="baud_${id}">Baud Rate</label>
                <select class="form-select" id="baud_${id}">
                    <option value="300">300</option>
                    <option value="1200">1200</option>
                    <option value="2400">2400</option>
                    <option value="4800">4800</option>
                    <option value="9600" selected>9600</option>
                    <option value="14400">14400</option>
                    <option value="19200">19200</option>
                    <option value="28800">28800</option>
                    <option value="31250">31250</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="74880">74880</option>
                    <option value="115200">115200</option>
                    <option value="230400">230400</option>
                    <option value="250000">250000</option>
                    <option value="500000">500000</option>
                    <option value="1000000">1000000</option>
                    <option value="2000000">2000000</option>
                </select>
            </div>

            <div class="button-row">
                <button class="btn" onclick="window.refreshPorts('${id}')">Refresh</button>
                <button class="btn btn-primary" onclick="window.toggleConnection('${id}')" id="connect_${id}">Connect</button>
                <button class="btn btn-danger" onclick="window.removeConnection('${id}')">Remove</button>
            </div>

            <div class="data-preview-header">
                <span class="data-preview-label">Data Preview</span>
                <div class="preview-controls" style="display: flex; gap: 4px;">
                    <button class="btn-icon btn-sm" onclick="window.copyDataPreview('${id}')" title="Copy Data" id="copy_${id}" style="display: none;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-sm" onclick="window.toggleDataPause('${id}')" title="Pause/Resume Scrolling" id="pause_${id}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="data-preview" id="data_${id}" onmousedown="event.stopPropagation()">
                <div class="data-line">Not connected</div>
            </div>
        `;
    }

    function getBLEFormHtml(id) {
        // Generate options from DEVICE_PROFILES
        let profileOptions = '';
        for (const [key, profile] of Object.entries(DEVICE_PROFILES)) {
            profileOptions += `<option value="${key}">${profile.name}</option>`;
        }

        return `
            <div class="form-group">
                <label class="form-label">Device Profile</label>
                <select class="form-select" id="ble_profile_${id}" onchange="window.handleProfileChange('${id}')">
                    ${profileOptions}
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Bluetooth Device</label>
                <select class="form-select" id="ble_device_${id}">
                    <option value="">Click Scan to find devices...</option>
                </select>
            </div>

            <div class="button-row">
                <button class="btn" onclick="window.scanBLE('${id}')" id="scan_${id}">Scan</button>
                <button class="btn btn-primary" onclick="window.finalizeBLEConnection('${id}')" id="connect_${id}" disabled>Connect</button>
                <button class="btn btn-danger" onclick="window.removeConnection('${id}')">Remove</button>
            </div>

            <div class="data-preview-header">
                <span class="data-preview-label">Data Preview</span>
                <div class="preview-controls" style="display: flex; gap: 4px;">
                    <button class="btn-icon btn-sm" onclick="window.copyDataPreview('${id}')" title="Copy Data" id="copy_${id}" style="display: none;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-sm" onclick="window.toggleDataPause('${id}')" title="Pause/Resume Scrolling" id="pause_${id}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="data-preview" id="data_${id}" onmousedown="event.stopPropagation()">
                <div class="data-line">Not connected</div>
            </div>
        `;
    }

    // Handle profile change - reset device list and scan button
    window.handleProfileChange = function (id) {
        console.log('handleProfileChange called for:', id);

        // Cancel any ongoing scan for this connection
        if (scanningConnectionId === id) {
            console.log('Cancelling ongoing scan due to profile change');
            if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
            scanningConnectionId = null;
        }

        const select = document.getElementById('ble_device_' + id);
        const scanBtn = document.getElementById('scan_' + id);
        const connectBtn = document.getElementById('connect_' + id);

        console.log('Elements found:', { select: !!select, scanBtn: !!scanBtn, connectBtn: !!connectBtn });

        if (select) {
            select.innerHTML = '<option value="">Click Scan to find devices...</option>';
            select.disabled = false;
        }

        if (scanBtn) {
            console.log('Resetting scan button text from:', scanBtn.textContent, 'to: Scan');
            scanBtn.textContent = 'Scan';
            scanBtn.disabled = false;
        }

        if (connectBtn) {
            connectBtn.disabled = true;
        }

        console.log('Device profile changed for connection:', id);
    };





    window.refreshPorts = async function (id) {
        console.log('Refreshing ports for:', id);

        try {
            const response = await fetch('/api/ports');
            const data = await response.json();
            const portSelect = document.getElementById('port_' + id);

            if (!portSelect) {
                console.error('Port select element not found for:', id);
                return;
            }

            portSelect.innerHTML = '<option value="">Select port...</option>';

            // Show ALL ports, not just Arduino ones
            if (data.all && data.all.length > 0) {
                data.all.forEach(function (port) {
                    const option = document.createElement('option');
                    option.value = port.path;
                    // On Windows, manufacturer might be missing or different.
                    // Show Path (COMx) + Manufacturer + VID/PID if available
                    let label = port.path;
                    if (port.manufacturer) {
                        label += ' - ' + port.manufacturer;
                    }
                    if (port.vendorId || port.productId) {
                        label += ` (${port.vendorId || '?'}:${port.productId || '?'})`;
                    }
                    option.textContent = label;
                    portSelect.appendChild(option);
                });
                console.log('Found', data.all.length, 'ports');
            } else {
                console.log('No ports found');
            }

        } catch (error) {
            console.error('Failed to refresh ports:', error);
        }
    };

    window.refreshAllPorts = function () {
        console.log('Refreshing all ports...');
        Object.keys(connections).forEach(function (id) {
            window.refreshPorts(id);
        });
    };

    window.toggleConnection = async function (id) {
        console.log('Toggling connection for:', id);

        const connection = connections[id];
        const connectBtn = document.getElementById('connect_' + id);

        if (!connection || !connectBtn) {
            console.error('Connection or button not found for:', id);
            return;
        }

        if (connection.status === 'disconnected') {
            const portSelect = document.getElementById('port_' + id);
            const selectedPort = portSelect.value;

            const baudSelect = document.getElementById('baud_' + id);
            const selectedBaud = parseInt(baudSelect.value);

            if (!selectedPort) {
                alert('Please select a port first');
                return;
            }

            connectBtn.textContent = 'Connecting...';
            connectBtn.disabled = true;

            try {
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        portPath: selectedPort,
                        baudRate: selectedBaud
                    })
                });

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error);
                }

                // Update UI immediately on success
                // The socket event will also update it, but this ensures immediate feedback
                updateConnectionStatus(id, 'connected', selectedPort);

            } catch (error) {
                console.error('Connection failed:', error);
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
                alert('Connection failed: ' + error.message);
            }
        } else {
            try {
                await fetch('/api/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
            } catch (error) {
                console.error('Disconnect failed:', error);
            }
        }
    };

    function updateConnectionStatus(id, status, port) {
        console.log('Updating status for', id, 'to', status);

        const connection = connections[id];
        if (!connection) return;

        connection.status = status;
        connection.port = port;

        const statusEl = document.getElementById('status_' + id);
        const connectBtn = document.getElementById('connect_' + id);
        const dataPreview = document.getElementById('data_' + id);

        if (!statusEl || !connectBtn || !dataPreview) {
            console.error('UI elements not found for:', id);
            return;
        }

        statusEl.className = 'status-badge status-' + status;

        switch (status) {
            case 'connected':
                statusEl.innerHTML = '<div class="status-dot"></div>Connected';
                connectBtn.textContent = 'Disconnect';
                connectBtn.disabled = false;
                connectBtn.className = 'btn btn-danger';
                dataPreview.classList.add('active');
                break;
            case 'connecting':
                statusEl.innerHTML = '<div class="status-dot"></div>Connecting';
                connectBtn.textContent = 'Connecting...';
                connectBtn.disabled = true;
                break;
            case 'disconnected':
                statusEl.innerHTML = '<div class="status-dot"></div>Disconnected';
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
                connectBtn.className = 'btn btn-primary';
                dataPreview.classList.remove('active');
                break;
        }
    }

    // Toggle Data Pause
    window.toggleDataPause = function (id) {
        const conn = connections[id];
        if (!conn) return;

        conn.isPaused = !conn.isPaused;

        const pauseBtn = document.getElementById('pause_' + id);
        const copyBtn = document.getElementById('copy_' + id);

        if (pauseBtn) {
            if (conn.isPaused) {
                // Show Play Icon
                pauseBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                pauseBtn.classList.add('active'); // Highlight when paused

                // Show Copy Button
                if (copyBtn) copyBtn.style.display = 'flex';
            } else {
                // Show Pause Icon
                pauseBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
                pauseBtn.classList.remove('active');

                // Hide Copy Button
                if (copyBtn) copyBtn.style.display = 'none';
            }
        }
    };

    function displaySerialData(id, data) {
        // Check if paused
        if (connections[id] && connections[id].isPaused) return;

        const dataPreview = document.getElementById('data_' + id);
        if (dataPreview) {
            const timestamp = new Date().toLocaleTimeString();
            const newLine = document.createElement('div');
            newLine.className = 'data-line';
            newLine.textContent = '[' + timestamp + '] ' + data;
            dataPreview.appendChild(newLine);
            dataPreview.scrollTop = dataPreview.scrollHeight;

            while (dataPreview.children.length > 50) {
                dataPreview.removeChild(dataPreview.firstChild);
            }
        }
    }

    // Copy Data Preview
    window.copyDataPreview = async function (id) {
        const dataPreview = document.getElementById('data_' + id);
        if (!dataPreview) return;

        const text = dataPreview.innerText;
        try {
            await navigator.clipboard.writeText(text);

            // Visual feedback
            const btn = document.getElementById('copy_' + id);
            if (btn) {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10B981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';

                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.borderColor = '';
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    window.removeConnection = function (id) {
        console.log('Removing connection:', id);

        if (connections[id]) {
            // Disconnect if connected
            if (connections[id].status === 'connected') {
                if (connections[id].type === 'ble') {
                    window.disconnectBLE(id);
                } else {
                    window.toggleConnection(id);
                }
            }

            // Cancel any active BLE scan
            if (scanningConnectionId === id) {
                if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
                scanningConnectionId = null;
            }
        }

        delete connections[id];

        const cardElement = document.getElementById('card_' + id);
        if (cardElement) {
            cardElement.remove();
        }

        if (Object.keys(connections).length === 0) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) {
                emptyState.style.display = '';
            }
        }

        // Update connection counts
        window.updateConnectionCounts();
    };

    window.toggleCard = function (id) {
        const card = document.getElementById('card_' + id);
        if (card) {
            card.classList.toggle('collapsed');
        }
    };

    window.showUsageInfo = function () {
        window.showUsageModal();
    };

    window.toggleWorkspaceCollapse = function () {
        const subcategories = document.getElementById('workspace-subcategories');
        const chevron = document.querySelector('.nav-icon-chevron');

        if (subcategories && chevron) {
            subcategories.classList.toggle('collapsed');
            chevron.classList.toggle('rotated');
        }
    };

    window.filterConnections = function (type) {
        console.log('Filtering connections by type:', type);

        // Update active state in sidebar
        const navItems = document.querySelectorAll('.nav-section .nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });

        // Set active based on filter type
        if (type === 'all') {
            navItems[0].classList.add('active');
        } else if (type === 'serial') {
            navItems[1].classList.add('active');
        } else if (type === 'ble') {
            navItems[2].classList.add('active');
        }

        // Filter connection cards
        for (const id in connections) {
            const card = document.getElementById('card_' + id);
            if (!card) continue;

            if (type === 'all') {
                card.style.display = '';
            } else if (type === connections[id].type) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        }

        // Update counts
        updateConnectionCounts();
    };

    window.updateConnectionCounts = function () {
        let serialCount = 0;
        let bleCount = 0;

        for (const id in connections) {
            if (connections[id].type === 'serial') {
                serialCount++;
            } else if (connections[id].type === 'ble') {
                bleCount++;
            }
        }

        const serialCountEl = document.getElementById('serial-count');
        const bleCountEl = document.getElementById('ble-count');

        if (serialCountEl) serialCountEl.textContent = serialCount;
        if (bleCountEl) bleCountEl.textContent = bleCount;
    };

    window.showUsageModal = function () {
        const modal = document.getElementById('usage-modal');
        const socketioUrlModal = document.getElementById('socketio-url-modal');
        if (socketioUrlModal) {
            socketioUrlModal.textContent = serverUrl;
        }
        modal.classList.add('active');
    };

    window.closeUsageModal = function () {
        const modal = document.getElementById('usage-modal');
        modal.classList.remove('active');
        localStorage.setItem('usageModalSeen', 'true');
    };

    // ========================================
    // SESSION MANAGEMENT
    // ========================================
    // Save and load connection configurations as JSON files

    /**
     * Saves the current connections to a JSON file
     * Exports connection names, types, ports, and settings
     * Does NOT save runtime state (connected/disconnected status)
     */
    window.saveSession = function () {
        console.log('Saving session...');

        // Create configuration object
        const config = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            connections: {}
        };

        // Extract connection configurations (exclude runtime state)
        for (const id in connections) {
            const conn = connections[id];
            config.connections[id] = {
                name: conn.name,
                type: conn.type
            };

            // Add type-specific configuration
            if (conn.type === 'serial') {
                config.connections[id].port = conn.port;
                config.connections[id].baudRate = conn.baudRate || 9600;
            } else if (conn.type === 'ble') {
                config.connections[id].deviceId = conn.deviceId;
                config.connections[id].deviceName = conn.deviceName;
                config.connections[id].profile = conn.profile;
            }
        }

        // Convert to JSON
        const jsonString = JSON.stringify(config, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `serial-bridge-session-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Session saved successfully');
    };

    window.loadSession = function () {
        console.log('Loading session...');

        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const config = JSON.parse(event.target.result);

                    // Validate configuration
                    if (!config.version || !config.connections) {
                        alert('Invalid session file format');
                        return;
                    }

                    // Confirm before clearing existing connections
                    if (Object.keys(connections).length > 0) {
                        if (!confirm('Loading a session will replace all current connections. Continue?')) {
                            return;
                        }
                    }

                    // Clear existing connections
                    const existingIds = Object.keys(connections);
                    for (const id of existingIds) {
                        window.removeConnection(id);
                    }

                    // Load connections from config
                    for (const id in config.connections) {
                        const connConfig = config.connections[id];

                        // Create connection object
                        connections[id] = {
                            status: 'disconnected',
                            type: connConfig.type,
                            name: connConfig.name,
                            port: connConfig.port || null,
                            baudRate: connConfig.baudRate || 9600,
                            deviceId: connConfig.deviceId || null,
                            deviceName: connConfig.deviceName || null,
                            profile: connConfig.profile || 'generic_uart'
                        };

                        // Create UI card
                        const emptyState = document.getElementById('empty-state');
                        if (emptyState) {
                            emptyState.style.display = 'none';
                        }

                        const connectionsDiv = document.getElementById('connections');
                        if (!connectionsDiv) continue;

                        const connectionCard = document.createElement('div');
                        connectionCard.className = 'connection-card';
                        connectionCard.id = 'card_' + id;
                        connectionCard.setAttribute('draggable', 'true');

                        // Drag Events
                        connectionCard.addEventListener('dragstart', () => {
                            setTimeout(() => {
                                connectionCard.classList.add('dragging');
                            }, 0);
                        });

                        connectionCard.addEventListener('dragend', () => {
                            connectionCard.classList.remove('dragging');
                        });

                        // Build HTML based on type
                        let html = `
                            <div class="card-header">
                                <div class="card-title">
                                    <input type="text" class="card-title-input" value="${connConfig.name}" onchange="window.updateConnectionName('${id}', this.value)">
                                    <div class="connection-id-group">
                                        <label class="id-label">ID:</label>
                                        <input type="text" class="connection-id-input" id="id_input_${id}" value="${id}" disabled>
                                        <button class="btn-edit-id" onclick="window.editConnectionId('${id}')" title="Edit Connection ID">Edit</button>
                                    </div>
                                </div>
                                <div class="card-controls">
                                    <div class="status-badge status-disconnected" id="status_${id}">
                                        <div class="status-dot"></div>
                                        Disconnected
                                    </div>
                                    <button class="btn-collapse" onclick="window.toggleCard('${id}')" title="Collapse/Expand">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="card-content" id="content_wrapper_${id}">
                                <div class="connection-type-toggle">
                                    <div class="toggle-option ${connConfig.type === 'serial' ? 'active' : ''}" id="toggle_serial_${id}" onclick="window.toggleConnectionType('${id}', 'serial')">USB</div>
                                    <div class="toggle-option ${connConfig.type === 'ble' ? 'active' : ''}" id="toggle_ble_${id}" onclick="window.toggleConnectionType('${id}', 'ble')">Bluetooth</div>
                                </div>

                                <div id="content_${id}">
                                    ${connConfig.type === 'serial' ? getSerialFormHtml(id) : getBLEFormHtml(id)}
                                </div>
                            </div>
                        `;

                        connectionCard.innerHTML = html;
                        connectionsDiv.appendChild(connectionCard);

                        connectionCard.innerHTML = html;
                        connectionsDiv.appendChild(connectionCard);

                        // Initialize input width
                        const idInput = document.getElementById('id_input_' + id);
                        if (idInput) window.resizeInput(idInput);

                        // If serial type, update port selection
                        if (connConfig.type === 'serial' && connConfig.port) {
                            const portSelect = document.getElementById('port_' + id);
                            if (portSelect) {
                                // Add the saved port as an option if it doesn't exist
                                let optionExists = false;
                                for (let i = 0; i < portSelect.options.length; i++) {
                                    if (portSelect.options[i].value === connConfig.port) {
                                        optionExists = true;
                                        break;
                                    }
                                }
                                if (!optionExists) {
                                    const option = document.createElement('option');
                                    option.value = connConfig.port;
                                    option.textContent = connConfig.port;
                                    portSelect.appendChild(option);
                                }
                                portSelect.value = connConfig.port;
                            }

                            const baudSelect = document.getElementById('baud_' + id);
                            if (baudSelect) {
                                baudSelect.value = connConfig.baudRate;
                            }
                        }

                        // If BLE type, update profile selection
                        if (connConfig.type === 'ble' && connConfig.profile) {
                            const profileSelect = document.getElementById('ble_profile_' + id);
                            if (profileSelect) {
                                profileSelect.value = connConfig.profile;
                            }
                        }
                    }

                    console.log('Session loaded successfully');
                    alert('Session loaded successfully!');

                } catch (error) {
                    console.error('Error loading session:', error);
                    alert('Error loading session file: ' + error.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    };

    // Show usage modal on first load
    if (!localStorage.getItem('usageModalSeen')) {
        setTimeout(() => {
            window.showUsageModal();
        }, 500);
    }

    // Debug helper
    window.debugConnections = function () {
        console.log('Current Connections:', connections);
        console.log('Keys:', Object.keys(connections));
    };

    window.copyCode = async function (btn) {
        const wrapper = btn.closest('.code-snippet-wrapper');
        if (!wrapper) return;

        const codeBlock = wrapper.querySelector('code');
        if (!codeBlock) return;

        const text = codeBlock.innerText;

        try {
            await navigator.clipboard.writeText(text);

            // Visual feedback
            const originalIcon = btn.innerHTML;
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
            btn.style.background = 'rgba(16, 185, 129, 0.1)';

            setTimeout(() => {
                btn.innerHTML = originalIcon;
                btn.style.borderColor = '';
                btn.style.background = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    console.log('Serial Bridge JavaScript loaded successfully');

})();
