(function () {
    console.log('Serial Bridge JavaScript loading...');

    const socket = io();

    // BLE Configuration
    const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    const UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to this
    const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Read from this

    let connections = {};

    // Global to track which card is currently scanning
    let scanningConnectionId = null;

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
    });

    // Add a new BLE configuration card
    window.addBLEConnection = function () {
        const id = getNextAvailableId();
        console.log('Creating BLE card with ID:', id);

        // Reserve ID
        connections[id] = {
            status: 'configuring',
            type: 'ble',
            device: null
        };

        const container = document.getElementById('connections');
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'none';

        const displayNum = getDisplayNumber(id);
        console.log('Display number for', id, 'is:', displayNum);

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
                <div class="status-badge status-disconnected" id="status_${id}">
                    <div class="status-dot"></div>
                    Configuring
                </div>
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
                <button class="btn btn-danger" onclick="window.removeBLE('${id}')">Remove</button>
            </div>

            <div class="data-preview" id="data_${id}">
                <div class="data-line">Not connected</div>
            </div>
        `;
        container.prepend(div);
    };

    // Start scanning for this card
    window.scanBLE = async function (id) {
        console.log('Starting BLE scan for card:', id);

        // Reset any previous scanning state
        if (scanningConnectionId && scanningConnectionId !== id) {
            console.warn('Another card was scanning, cancelling it first');
            if (ipcRenderer) ipcRenderer.send('bluetooth-device-cancelled');
        }

        scanningConnectionId = id;
        const scanBtn = document.getElementById('scan_' + id);
        const select = document.getElementById('ble_device_' + id);

        if (scanBtn) scanBtn.textContent = 'Scanning...';
        if (select) {
            select.innerHTML = '<option>Scanning...</option>';
            select.disabled = true;
        }

        try {
            console.log('Calling navigator.bluetooth.requestDevice...');
            // Request device - this will trigger the IPC flow
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [UART_SERVICE_UUID] }],
                optionalServices: [UART_SERVICE_UUID]
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
        }
    };

    // Update the dropdown with found devices
    function updateBLEDeviceList(id, deviceList) {
        const select = document.getElementById('ble_device_' + id);
        const connectBtn = document.getElementById('connect_' + id);

        if (!select) return;

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
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.deviceName || `Unknown Device (${device.deviceId})`;
                select.add(option);

                if (device.deviceId === currentSelection) {
                    selectionFound = true;
                }
            });

            // Restore selection if it still exists
            if (selectionFound) {
                select.value = currentSelection;
            }

            // Enable connect button if user selects something
            select.onchange = () => {
                if (connectBtn) connectBtn.disabled = select.value === "";
            };

            // Ensure button state matches restored selection
            if (connectBtn) connectBtn.disabled = select.value === "";
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
        device.addEventListener('gattserverdisconnected', handleDisconnect);

        try {
            // Add timeout for connection
            const connectPromise = device.gatt.connect();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timed out')), 10000)
            );

            const server = await Promise.race([connectPromise, timeoutPromise]);

            // Add a delay to ensure connection is stable before getting services
            // Increased to 1000ms to fix "GATT Service no longer exists"
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('Getting Service...');
            const service = await server.getPrimaryService(UART_SERVICE_UUID);

            console.log('Getting Characteristics...');
            const txChar = await service.getCharacteristic(UART_TX_CHAR_UUID);

            console.log('Starting Notifications...');
            await txChar.startNotifications();
            txChar.addEventListener('characteristicvaluechanged', handleBLEData);

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

    function handleBLEData(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const data = decoder.decode(value);

        // Find the ID for this device
        const device = event.target.service.device;
        let connectionId = null;

        for (const [id, conn] of Object.entries(connections)) {
            if (conn.type === 'ble' && conn.device === device) {
                connectionId = id;
                break;
            }
        }

        if (connectionId) {
            // Forward to socket
            socket.emit('ble-data', { device: connectionId, data: data });

            // Update UI using standard function
            displaySerialData(connectionId, data);
        }
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

                await setupBLEDevice(conn.device);

            } catch (error) {
                console.error('Reconnection failed:', error);
                alert('Reconnection failed: ' + error);
                updateBLEUIStatus(id, 'disconnected');
            }
        } else {
            alert('Device information lost. Please remove and add again.');
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

    socket.on('connection-status', function (data) {
        console.log('Connection status update:', data);
        updateConnectionStatus(data.id, data.status, data.port);
    });

    socket.on('serial-data', function (data) {
        console.log('Serial data received:', data);
        displaySerialData(data.id, data.data);
    });

    // Get the next available ID using lowest-available logic
    function getNextAvailableId() {
        let num = 1;
        while (connections.hasOwnProperty('arduino_' + num)) {
            num++;
        }
        return 'arduino_' + num;
    }

    // Calculate the display number for the Arduino (e.g., "Arduino 1")
    function getDisplayNumber(id) {
        const match = id.match(/^arduino_(\d+)$/);
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

        const removeBtn = card ? card.querySelector('[onclick*="removeBLE"]') : null;
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `window.removeBLE('${newId}')`);
        }

        const editBtn = card ? card.querySelector('[onclick*="editConnectionId"]') : null;
        if (editBtn) {
            editBtn.setAttribute('onclick', `window.editConnectionId('${newId}')`);
        }

        const dataPreview = document.getElementById('data_' + oldId);
        if (dataPreview) dataPreview.id = 'data_' + newId;

        // For standard serial ports
        const portSelect = document.getElementById('port_' + oldId);
        if (portSelect) {
            portSelect.id = 'port_' + newId;
            portSelect.setAttribute('name', 'port_' + newId);
        }

        // Update standard onclick handlers if they exist (for non-BLE)
        if (card && connections[newId].type !== 'ble') {
            const refreshBtn = card.querySelector('[onclick*="refreshPorts"]');
            if (refreshBtn) refreshBtn.setAttribute('onclick', 'window.refreshPorts(\'' + newId + '\')');

            const toggleBtn = card.querySelector('[onclick*="toggleConnection"]');
            if (toggleBtn) toggleBtn.setAttribute('onclick', 'window.toggleConnection(\'' + newId + '\')');

            const removeBtnSerial = card.querySelector('[onclick*="removeConnection"]');
            if (removeBtnSerial) removeBtnSerial.setAttribute('onclick', 'window.removeConnection(\'' + newId + '\')');
        }

        console.log('Renamed connection from ' + oldId + ' to ' + newId);
        return true;
    };


    // Enable editing of connection ID
    window.editConnectionId = function (id) {
        const idInput = document.getElementById('id_input_' + id);
        const oldValue = idInput.value;

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
            // Clear handlers to prevent memory leaks or weird states
            idInput.onkeydown = null;
            idInput.onblur = null;
        };
    };

    window.addConnection = function () {
        console.log('Adding new connection...');

        const id = getNextAvailableId();
        connections[id] = { status: 'disconnected', port: null };

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

        const displayNum = getDisplayNumber(id);
        const connectionCard = document.createElement('div');
        connectionCard.className = 'connection-card';
        connectionCard.id = 'card_' + id;

        connectionCard.innerHTML =
            '<div class="card-header">' +
            '<div class="card-title">' +
            '<h3>Arduino ' + displayNum + '</h3>' +
            '<div class="connection-id-group">' +
            '<label class="id-label">ID:</label>' +
            '<input type="text" class="connection-id-input" id="id_input_' + id + '" value="' + id + '" disabled>' +
            '<button class="btn-edit-id" onclick="window.editConnectionId(\'' + id + '\')" title="Edit Connection ID">Edit</button>' +
            '</div>' +
            '</div>' +
            '<div class="status-badge status-disconnected" id="status_' + id + '">' +
            '<div class="status-dot"></div>' +
            'Disconnected' +
            '</div>' +
            '</div>' +

            '<div class="form-group">' +
            '<label class="form-label" for="port_' + id + '">Serial Port</label>' +
            '<select class="form-select" id="port_' + id + '">' +
            '<option value="">Select port...</option>' +
            '</select>' +
            '</div>' +

            '<div class="form-group">' +
            '<label class="form-label" for="baud_' + id + '">Baud Rate</label>' +
            '<select class="form-select" id="baud_' + id + '">' +
            '<option value="300">300</option>' +
            '<option value="1200">1200</option>' +
            '<option value="2400">2400</option>' +
            '<option value="4800">4800</option>' +
            '<option value="9600" selected>9600</option>' +
            '<option value="14400">14400</option>' +
            '<option value="19200">19200</option>' +
            '<option value="28800">28800</option>' +
            '<option value="31250">31250</option>' +
            '<option value="38400">38400</option>' +
            '<option value="57600">57600</option>' +
            '<option value="74880">74880</option>' +
            '<option value="115200">115200</option>' +
            '<option value="230400">230400</option>' +
            '<option value="250000">250000</option>' +
            '<option value="500000">500000</option>' +
            '<option value="1000000">1000000</option>' +
            '<option value="2000000">2000000</option>' +
            '</select>' +
            '</div>' +

            '<div class="button-row">' +
            '<button class="btn" onclick="window.refreshPorts(\'' + id + '\')">Refresh</button>' +
            '<button class="btn btn-primary" onclick="window.toggleConnection(\'' + id + '\')" id="connect_' + id + '">Connect</button>' +
            '<button class="btn btn-danger" onclick="window.removeConnection(\'' + id + '\')">Remove</button>' +
            '</div>' +

            '<div class="data-preview" id="data_' + id + '">' +
            '<div class="data-line">Waiting for data...</div>' +
            '</div>';

        connectionsDiv.appendChild(connectionCard);

        console.log('Connection card added to DOM');

        window.refreshPorts(id);
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

    function displaySerialData(id, data) {
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

    window.removeConnection = function (id) {
        console.log('Removing connection:', id);

        if (connections[id] && connections[id].status === 'connected') {
            window.toggleConnection(id);
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
    };

    window.showUsageInfo = function () {
        window.showUsageModal();
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

    // Show modal on first visit
    if (!localStorage.getItem('usageModalSeen')) {
        window.showUsageModal();
    }

    // Debug helper
    window.debugConnections = function () {
        console.log('Current Connections:', connections);
        console.log('Keys:', Object.keys(connections));
    };

    console.log('Serial Bridge JavaScript loaded successfully');

})();
