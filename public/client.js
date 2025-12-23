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
    const ipcRenderer = window.electron ? window.electron.ipcRenderer : null;

    // Helper to resize input based on content
    window.resizeInput = function (el) {
        if (!el) return; // Safety check
        // Reset width to min to calculate scrollWidth correctly
        el.style.width = '1ch';
        el.style.width = (el.scrollWidth) + 'px';
    };

    // ===== CONFIGURATION =====
    // BLE UART Service UUIDs (Nordic UART Service standard)


    // ===== DEVICE PROFILES =====

    // Profiles are now loaded from public/profiles/*.js into window.DEVICE_PROFILES
    const DEVICE_PROFILES = window.DEVICE_PROFILES || {};



    // ===== STATE MANAGEMENT =====
    let connections = {};           // Stores all connection data (id -> connection object)
    let scanningConnectionId = null; // Tracks which card is currently scanning for BLE

    // IPC Renderer is exposed via preload.js as window.electron.ipcRenderer
    console.log('Client: IPC Renderer available:', !!ipcRenderer);

    document.addEventListener('DOMContentLoaded', async () => {
        // BLE Button Handler
        const bleBtn = document.getElementById('connect-ble-btn');
        if (bleBtn) {
            // Change to add a new BLE connection card instead of direct connect
            bleBtn.addEventListener('click', addBLEConnection);
        }

        // Settings button is now always visible for Analytics
        // Notch logic is handled inside the modal


        // Handle BLE Device List from Main Process
        if (ipcRenderer) {
            ipcRenderer.on('bluetooth-device-list', (deviceList) => {
                console.log('Client: Received bluetooth-device-list', deviceList);
                if (scanningConnectionId) {
                    updateBLEDeviceList(scanningConnectionId, deviceList);
                }
            });

            // Handle OSC Errors (e.g. Port Busy)
            ipcRenderer.on('osc-error', (event, { type, port, message }) => {
                console.error(`[OSC] Error on ${type} port ${port}: ${message}`);
                showErrorModal(
                    'OSC Port Error',
                    `The <strong>${type === 'receive' ? 'Receiving' : 'Broadcast'} Port (${port})</strong> is already in use by another application.<br><br>` +
                    'Please choose a different port in <strong>Broadcast Settings</strong>.'
                );

                // Optionally turn off the toggle in UI to reflect failure
                if (type === 'receive') {
                    const toggle = document.getElementById('osc-receive-toggle');
                    if (toggle) {
                        // DEBUG: Check if we are receiving ANY data
                        console.log(`Data received from ${type} (${uuid})`, event.target.value);
                        toggle.checked = false;
                        const receiveGroup = document.getElementById('osc-receive-config-group');
                        if (receiveGroup) receiveGroup.style.display = 'none';
                    }
                }
            });
        } else {
            console.warn('IPC Renderer not available. BLE selection might fail.');
        }

        // Initialize Broadcast Indicator
        if (ipcRenderer) {
            ipcRenderer.invoke('get-settings').then(settings => {
                updateBroadcastUI(settings);
            });
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
    // BLUETOOTH (BLE) LOGIC
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

            // Update connection object with selected profile immediately
            if (connections[id]) {
                connections[id].profile = profileKey;
            }

            // Normalize service UUID
            const serviceUuid = typeof profile.service === 'string' && profile.service.length > 20
                ? profile.service.toLowerCase()
                : profile.service;

            console.log(`Scanning for profile: ${profile.name} (Service: ${serviceUuid})`);

            // Request device - this will trigger the IPC flow
            // We explicitly add the service to optionalServices to avoid "Origin is not allowed" errors
            const requestOptions = {
                filters: [{ services: [serviceUuid] }],
                optionalServices: [serviceUuid]
            };
            console.log('Requesting device with options:', JSON.stringify(requestOptions));

            const device = await navigator.bluetooth.requestDevice(requestOptions);

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
                // console.log('Client: Processing device:', device);

                const option = document.createElement('option');
                option.value = device.deviceId;

                // Show MAC address to help distinguish devices with same name
                // Extract last 5 chars of MAC for brevity (e.g., "20:BF")
                const macSuffix = device.deviceId.slice(-5);
                const displayName = device.name || device.deviceName || 'Unknown Device';
                option.text = `${displayName} (${macSuffix})`;

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
    window.finalizeBLEConnection = async function (id) {
        const select = document.getElementById('ble_device_' + id);
        const deviceId = select.value;

        if (!deviceId) return;

        const connectBtn = document.getElementById('connect_' + id);
        if (connectBtn) {
            connectBtn.textContent = 'Connecting...';
            connectBtn.disabled = true;
        }

        // Case 1: Scan is active. We just need to tell Electron to pick this device.
        if (scanningConnectionId === id) {
            if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.send('bluetooth-device-selected', deviceId);
            }
            return;
        }

        // Case 2: Scan ended (e.g. previous error). We need to re-request the device.
        console.log('Scan not active, re-acquiring device...');

        try {
            // 1. Get Profile
            const profileSelect = document.getElementById('ble_profile_' + id);
            const profileKey = profileSelect ? profileSelect.value : 'generic_uart';
            const profile = DEVICE_PROFILES[profileKey];

            // Update connection object with selected profile immediately
            if (connections[id]) {
                connections[id].profile = profileKey;
            }

            // Normalize UUID
            const serviceUuid = typeof profile.service === 'string' && profile.service.length > 20
                ? profile.service.toLowerCase()
                : profile.service;

            // 2. Start Request (Async)
            // We don't await this yet, because we need to send the IPC to resolve it!
            const requestOptions = {
                filters: [{ services: [serviceUuid] }],
                optionalServices: [serviceUuid]
            };
            const requestPromise = navigator.bluetooth.requestDevice(requestOptions);

            // 3. Send IPC to select the device immediately
            // Give a tiny delay to ensure requestDevice is registered in Electron
            setTimeout(() => {
                if (window.electron && window.electron.ipcRenderer) {
                    window.electron.ipcRenderer.send('bluetooth-device-selected', deviceId);
                }
            }, 200);

            // 4. Await the device
            const device = await requestPromise;

            // 5. Connect
            await setupBLEDevice(device, id);

        } catch (error) {
            console.error('Re-acquisition failed:', error);
            if (connectBtn) {
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
            }
            alert('Connection failed: ' + error.message);
        }
    };

    // Helper to trigger notch from client
    function triggerNotch(type, message, icon) {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send('show-notch', { type, message, icon });
        }
    }

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

            // Check if this was a manual disconnect
            if (connections[connectionId].manualDisconnect) {
                console.log('Manual disconnect detected, not reconnecting.');
                updateBLEUIStatus(connectionId, 'disconnected');
                connections[connectionId].status = 'disconnected';

                // Emit status to Socket.IO
                socket.emit('connection-status', {
                    id: connectionId,
                    status: 'disconnected'
                });

                const deviceName = connections[connectionId].name || 'Bluetooth Device';
                const profile = connections[connectionId].profile;
                const icon = getDeviceIcon('bluetooth', profile);
                triggerNotch('disconnect', deviceName + ' Disconnected', icon);
            } else {
                // Unintentional disconnect (e.g. display plug/unplug)
                console.log('Unintentional disconnect detected! Attempting auto-reconnect in 2s...');

                // Update UI to show reconnecting state
                updateBLEUIStatus(connectionId, 'reconnecting');
                connections[connectionId].status = 'reconnecting';

                // Trigger Notch Warning
                const deviceName = connections[connectionId].name || 'Bluetooth Device';
                const profile = connections[connectionId].profile;
                const icon = getDeviceIcon('bluetooth', profile);
                triggerNotch('reconnecting', 'Reconnecting ' + deviceName + '...', icon);

                // Attempt Reconnect
                setTimeout(() => {
                    if (connections[connectionId] && connections[connectionId].status === 'reconnecting') {
                        setupBLEDevice(device, connectionId).catch(err => {
                            console.error('Auto-reconnect failed:', err);
                            // If it fails, finally set to disconnected
                            updateBLEUIStatus(connectionId, 'disconnected');
                            connections[connectionId].status = 'disconnected';

                            const profile = connections[connectionId].profile;
                            const icon = getDeviceIcon('bluetooth', profile);
                            triggerNotch('disconnect', deviceName + ' Disconnected', icon);
                        });
                    }
                }, 2000);
            }
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

            // Normalize service UUID to lowercase if it's a string (standard names like 'heart_rate' are fine)
            const serviceUuid = typeof profile.service === 'string' && profile.service.length > 20
                ? profile.service.toLowerCase()
                : profile.service;

            console.log(`Connecting using profile: ${profile.name}`);
            console.log(`Target Service UUID: ${serviceUuid}`);

            console.log('Getting Service...');
            let service;
            let retryCount = 0;
            const MAX_RETRIES = 3;

            while (retryCount < MAX_RETRIES) {
                try {
                    // Check connection state before requesting service
                    if (!device.gatt.connected) {
                        console.log('GATT disconnected during setup, reconnecting...');
                        await device.gatt.connect();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    service = await server.getPrimaryService(serviceUuid);
                    break; // Success
                } catch (err) {
                    console.warn(`Attempt ${retryCount + 1} to get service ${serviceUuid} failed:`, err);
                    retryCount++;
                    if (retryCount === MAX_RETRIES) throw err;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
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
                // Single characteristic support (Generic UART, Heart Rate, etc.)
                const txChar = await service.getCharacteristic(profile.characteristic);
                await txChar.startNotifications();
                txChar.addEventListener('characteristicvaluechanged', (event) => {
                    console.log(`Data received from characteristic ${profile.characteristic}`, event.target.value);
                    handleBLEData(event, targetId);
                });

                // Keep-Alive Mechanism for Heart Rate Monitor
                // Prevents idle timeout disconnections (Whoop, Polar, Garmin, etc.)
                if (profileKey === 'heart_rate' && targetId && connections[targetId]) {
                    console.log('Heart Rate Monitor: Starting Keep-Alive interval (90s)...');
                    connections[targetId].keepAliveInterval = setInterval(async () => {
                        if (connections[targetId] && connections[targetId].status === 'connected' && txChar) {
                            try {
                                // Read the value to keep connection active
                                await txChar.readValue();
                                // console.log('Heart Rate: Keep-Alive read success');
                            } catch (e) {
                                console.warn('Heart Rate: Keep-Alive failed:', e);
                            }
                        } else {
                            // Stop if disconnected
                            if (connections[targetId] && connections[targetId].keepAliveInterval) {
                                clearInterval(connections[targetId].keepAliveInterval);
                            }
                        }
                    }, 90000); // Every 90 seconds
                }
            }

            // Track Analytics: Device Connected (BLE)
            if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.invoke('track-event', 'device_connected', {
                    type: 'ble',
                    profile: profileKey
                });
            }

            // Start Sequence / Handshake Logic
            if (profile.startSequence && Array.isArray(profile.startSequence)) {
                console.log(`Executing Start Sequence for ${profile.name}...`);
                const controlChar = await service.getCharacteristic(profile.controlCharacteristic);

                for (const cmd of profile.startSequence) {
                    console.log(`Sending Command: ${cmd.description || 'Unknown'}`);

                    // Convert hex string or array to Uint8Array
                    let commandBytes;
                    if (Array.isArray(cmd.value)) {
                        commandBytes = new Uint8Array(cmd.value);
                    } else if (typeof cmd.value === 'string') {
                        // Text command
                        const enc = new TextEncoder();
                        commandBytes = enc.encode(cmd.value);
                    }

                    await controlChar.writeValue(commandBytes);

                    // Wait if delay is specified
                    if (cmd.wait) {
                        console.log(`Waiting ${cmd.wait}ms...`);
                        await new Promise(r => setTimeout(r, cmd.wait));
                    }
                }
                console.log('Start Sequence Complete!');
            } else if (profile.controlCharacteristic) {
                // Legacy: Special handling for Muse 2 (Hardcoded 'd' command)
                // Kept strictly to ensure no regression for existing Muse 2 profile
                console.log('Muse 2 (Legacy): Getting Control Characteristic...');
                const controlChar = await service.getCharacteristic(profile.controlCharacteristic);
                console.log('Muse 2 (Legacy): Sending Start Command (d) with length prefix...');
                // Command: <length> <char> <newline>
                const command = new Uint8Array([0x02, 0x64, 0x0a]);
                await controlChar.writeValue(command);
                console.log('Muse 2 (Legacy): Start Command Sent!');
            }

            // Keep-Alive Mechanism
            // If the profile defines a keepAliveCmd, use it. Otherwise fall back to legacy Muse checks.
            // Check if explicitly disabled (Athena throws GATT errors on read)
            if (profile.enableKeepAlive !== false && (profile.keepAliveCmd || (profile.controlCharacteristic && targetId && connections[targetId]))) {
                const keepAliveMs = profile.keepAliveInterval || 60000;
                console.log(`Starting Keep-Alive interval (${keepAliveMs}ms)...`);

                // Reuse control char reference if possible, otherwise get it
                let keepAliveChar;
                if (profile.controlCharacteristic) {
                    keepAliveChar = await service.getCharacteristic(profile.controlCharacteristic);
                }

                connections[targetId].keepAliveInterval = setInterval(async () => {
                    if (connections[targetId] && connections[targetId].status === 'connected' && keepAliveChar) {
                        try {
                            if (profile.keepAliveCmd) {
                                // Send specific command
                                let cmdBytes;
                                if (typeof profile.keepAliveCmd === 'string') {
                                    cmdBytes = new TextEncoder().encode(profile.keepAliveCmd);
                                } else {
                                    cmdBytes = new Uint8Array(profile.keepAliveCmd);
                                }
                                await keepAliveChar.writeValue(cmdBytes);
                            } else {
                                // Default Passive Read (Muse 2 behavior)
                                await keepAliveChar.readValue();
                            }
                            // console.log('Keep-Alive read success');
                        } catch (e) {
                            console.warn('Keep-Alive failed:', e);
                        }
                    } else {
                        if (connections[targetId] && connections[targetId].keepAliveInterval) {
                            clearInterval(connections[targetId].keepAliveInterval);
                        }
                    }
                }, keepAliveMs);
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
                connections[targetId].status = 'connected';
                connections[targetId].device = device;
                connections[targetId].manualDisconnect = false;

                // Emit status to Socket.IO for p5.js and other clients
                socket.emit('connection-status', {
                    id: targetId,
                    status: 'connected',
                    port: device.name
                });

                // Trigger Notch Notification
                // Use the card name (e.g. "Serial Device 1") for consistency
                const cardName = connections[targetId].name || device.name;
                const icon = getDeviceIcon('bluetooth', profileKey);
                triggerNotch('bluetooth-success', cardName + ' Connected', icon);

                // Track Analytics
                if (window.electron && window.electron.ipcRenderer) {
                    console.log('[Analytics] Sending bluetooth_connected:', {
                        device_name: device.name || 'Unknown',
                        profile: profileKey
                    });
                    window.electron.ipcRenderer.invoke('track-event', 'bluetooth_connected', {
                        device_name: device.name || 'Unknown',
                        profile: profileKey
                    });

                    // Track specific profile as its own event for easier plotting in Aptabase
                    window.electron.ipcRenderer.invoke('track-event', `profile_connected_${profileKey}`);
                }

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
                    // Defensive fallback for non-standard flows
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

            // Track Analytics: Connection Failed (BLE)
            if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.invoke('track-event', 'error', {
                    process: 'renderer',
                    type: 'connection_failed',
                    connectionType: 'ble',
                    message: error.message
                });
            }

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
    // Parsers are now handled by individual profiles in public/profiles/*.js



    function handleBLEData(event, connectionId, type = null) {
        const value = event.target.value;
        // console.log(`BLE Data received for ${connectionId}`, value.byteLength); // Trace raw size

        // Get the connection and its parser
        const connection = connections[connectionId];
        if (!connection || !connection.parser) {
            console.warn('No parser found for connection:', connectionId);
            return;
        }

        try {
            // Use the connection's parser to decode the data
            const parsedData = connection.parser(value, type);

            if (parsedData === null) {
                // Parser returned null (invalid/incomplete packet)
                console.warn('Parser returned null for data. RAW:', new Uint8Array(value.buffer).slice(0, 10));
                return;
            }

            // Forward to socket
            socket.emit('ble-data', { device: connectionId, data: parsedData });

            // Update UI using standard function
            displaySerialData(connectionId, parsedData);

        } catch (e) {
            console.error("Parser Error:", e);
        }
    }

    // ========================================
    // UI HELPER FUNCTIONS
    // ========================================

    // ===== ICONS =====
    const USB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    const BLUETOOTH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10-5 5V2l5 5L7 17"></path></svg>`;

    // Custom Icons (User Selected)
    const BRAINWAVE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l2-9 4 18 4-18 3 9h4"></path></svg>`;
    const HEART_PULSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
    const BROADCAST_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>`;

    function getDeviceIcon(type, profileId) {
        if (profileId === 'muse_2') return BRAINWAVE_ICON;
        if (profileId === 'heart_rate') return HEART_PULSE_ICON;

        // Default fallbacks
        if (type === 'bluetooth') return BLUETOOTH_ICON;
        return USB_ICON;
    }



    window.disconnectBLE = function (id) {
        const conn = connections[id];

        // Set manual flag so handleDisconnect knows not to reconnect
        if (conn) {
            conn.manualDisconnect = true;
        }

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
                // Reset inline styles from reconnecting state
                statusEl.style.backgroundColor = '';
                statusEl.style.color = '';
                statusEl.style.border = '';
                statusEl.innerHTML = '<div class="status-dot"></div>Connected';
            } else if (status === 'reconnecting') {
                statusEl.className = 'status-badge';
                statusEl.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
                statusEl.style.color = '#ffc107';
                statusEl.style.border = '1px solid rgba(255, 193, 7, 0.3)';
                statusEl.innerHTML = '<div class="status-dot" style="background:#ffc107; box-shadow: 0 0 10px #ffc107;"></div>Reconnecting...';
            } else {
                statusEl.className = 'status-badge status-disconnected';
                // Reset inline styles
                statusEl.style.backgroundColor = '';
                statusEl.style.color = '';
                statusEl.style.border = '';
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
            } else if (status === 'reconnecting') {
                btn.textContent = 'Cancel';
                btn.setAttribute('onclick', `window.disconnectBLE('${id}')`);
                btn.className = 'btn btn-warning';
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



    window.removeBLE = function (id) {
        console.log('Removing BLE connection:', id);

        // If this card was scanning, cancel the scan
        if (scanningConnectionId === id) {
            console.log('Cancelling active scan for', id);
            if (window.electron && window.electron.ipcRenderer) window.electron.ipcRenderer.send('bluetooth-device-cancelled');
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

        // State Restoration: If this ID doesn't exist locally, create it.
        // This happens when the window is recreated but the server has active connections.
        if (!connections[data.id]) {
            console.log('Restoring connection from server state:', data.id);
            // Create the card structure
            addConnection(data.id);
            // Note: addConnection generates a default name
        }

        updateConnectionStatus(data.id, data.status, data.port);
    });

    socket.on('connect-error', function (data) {
        console.error('Connection error received:', data);
        if (connections[data.id]) {
            updateConnectionStatus(data.id, 'disconnected');
            // Trigger Notch (Error)
            const deviceName = connections[data.id].name || 'Serial Device';
            triggerNotch('error', 'Connection Failed: ' + data.error);
        }
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
        // Ensure device is disconnected before renaming
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
    window.addConnection = function (restoredId = null) {
        console.log('Adding new connection...');

        const id = restoredId || getNextAvailableId();
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



                const deviceName = connections[id].name || 'Serial Device';
                triggerNotch('success', deviceName + ' Connected', 'serial');

                // Track Analytics: Device Connected (Serial)
                if (window.electron && window.electron.ipcRenderer) {
                    window.electron.ipcRenderer.invoke('track-event', 'device_connected', {
                        type: 'serial',
                        baudRate: selectedBaud
                    });
                }

            } catch (error) {
                console.error('Connection failed:', error);

                // Track Analytics: Connection Failed (Serial)
                if (window.electron && window.electron.ipcRenderer) {
                    window.electron.ipcRenderer.invoke('track-event', 'error', {
                        process: 'renderer',
                        type: 'connection_failed',
                        connectionType: 'serial',
                        message: error.message
                    });
                }

                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;

                // Check error message for specific error types

                if (error.message.includes('Access denied') || error.message.includes('Resource busy')) {
                    showErrorModal(
                        'Port Busy',
                        'This port is currently locked by another application.<br><br>' +
                        '<strong>Troubleshooting:</strong><br>' +
                        '1. Is the Arduino IDE Serial Monitor open? Close it.<br>' +
                        '2. Is another serial app running?<br>' +
                        '3. Try unplugging and replugging the device in a different port.'
                    );
                } else if (error.message.includes('No such file or directory')) {
                    const portName = selectedPort || 'the selected port';
                    showErrorModal(
                        'Device Not Found',
                        `The port <strong>${portName}</strong> could not be found.<br><br>` +
                        '<strong>Troubleshooting:</strong><br>' +
                        '1. Check if the USB cable is securely connected.<br>' +
                        '2. Click <strong>Refresh Ports</strong> to update the list.<br>' +
                        '3. Select the correct port from the dropdown.'
                    );
                } else {
                    showErrorModal('Connection Failed', error.message);
                }
            }
        } else {
            try {
                await fetch('/api/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                // UI update happens via socket event
            } catch (error) {
                console.error('Disconnect failed:', error);
                showErrorModal('Disconnect Failed', error.message);
            }
        }
    };

    // Helper function to show custom error modal
    window.showErrorModal = function (title, message) {
        const modal = document.getElementById('error-modal');
        const titleEl = document.getElementById('error-title');
        const messageEl = document.getElementById('error-message');

        if (modal && titleEl && messageEl) {
            titleEl.textContent = title;
            messageEl.innerHTML = message; // Use innerHTML to support <br> and <strong>
            modal.classList.add('visible');
            console.log('✅ Error modal shown');
        } else {
            console.log('❌ Modal elements not found:', { modal: !!modal, titleEl: !!titleEl, messageEl: !!messageEl });
            // Fallback if modal elements are missing
            alert(title + '\n\n' + message.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, ""));
        }
    };

    window.closeErrorModal = function () {
        const modal = document.getElementById('error-modal');
        if (modal) {
            modal.classList.remove('visible');
        }
    };

    // Close modal when clicking outside
    // Close modal when clicking outside
    window.onclick = function (event) {
        const errorModal = document.getElementById('error-modal');
        const usageModal = document.getElementById('usage-modal');
        const settingsModal = document.getElementById('settings-modal');

        if (event.target == errorModal) {
            window.closeErrorModal();
        }
        if (event.target == usageModal) {
            window.closeUsageModal();
        }
        if (event.target == settingsModal) {
            window.closeSettingsModal();
        }
    };

    // Settings Modal Logic
    window.openSettingsModal = async function () {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');

            // Load current settings
            if (ipcRenderer) {
                try {
                    // Check hardware compatibility first
                    const hasNotch = await ipcRenderer.invoke('has-notch');
                    const notchGroup = document.getElementById('notch-settings-group');

                    if (notchGroup) {
                        if (hasNotch) {
                            notchGroup.style.display = 'flex';
                        } else {
                            notchGroup.style.display = 'none';
                        }

                        const settings = await ipcRenderer.invoke('get-settings');

                        // Sync Notch Toggle (only if visible)
                        if (hasNotch) {
                            const notchSoundToggle = document.getElementById('notch-sound-toggle');
                            if (notchSoundToggle) notchSoundToggle.checked = settings.notchSoundsEnabled === true;
                            const notchToggle = document.getElementById('notch-toggle');
                            if (notchToggle) {
                                notchToggle.checked = settings.notchEnabled;
                            }
                        }

                        // Sync Analytics Toggle
                        const analyticsToggle = document.getElementById('analytics-toggle');
                        if (analyticsToggle) {
                            analyticsToggle.checked = settings.analyticsEnabled;
                        }
                    }
                } catch (e) {
                    console.error('Failed to load settings:', e);
                }
            }
        }
    };

    window.closeSettingsModal = function () {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    window.toggleNotchSetting = async function (checkbox) {
        if (ipcRenderer) {
            try {
                await ipcRenderer.invoke('update-setting', 'notchEnabled', checkbox.checked);
            } catch (error) {
                console.error('Failed to update notch setting:', error);
                checkbox.checked = !checkbox.checked;
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
        const portSelect = document.getElementById('port_' + id); // Added for disabling

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

                // Trigger Notch (Success)
                // We check if this is a Serial connection (BLE handles its own triggers usually, but this function is shared)
                // Actually, updateConnectionStatus is primarily for Serial via Socket.IO.
                // BLE uses updateBLEUIStatus.
                if (connections[id] && connections[id].type !== 'ble') {
                    const deviceName = connections[id].name || 'Serial Device';
                    triggerNotch('success', deviceName + ' Connected', 'serial');

                    // Track Analytics
                    if (window.electron && window.electron.ipcRenderer) {
                        window.electron.ipcRenderer.invoke('track-event', 'serial_connected', {
                            port: connection.port || 'Unknown'
                        });
                    }
                }

                // Disable port selection
                if (portSelect) portSelect.disabled = true;
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

                // Trigger Notch (Disconnect)
                if (connections[id] && connections[id].type !== 'ble') {
                    const deviceName = connections[id].name || 'Serial Device';
                    triggerNotch('disconnect', deviceName + ' Disconnected', 'serial');
                }

                // Enable port selection
                if (portSelect) portSelect.disabled = false;
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

            // Handle object data (e.g. from Muse or Whoop)
            let displayData = data;
            if (typeof data === 'object' && data !== null) {
                displayData = JSON.stringify(data);
            }

            newLine.textContent = '[' + timestamp + '] ' + displayData;
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
    window.saveSession = async function () {
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

        // Add OSC settings if available
        if (window.electron && window.electron.ipcRenderer) {
            try {
                const settings = await window.electron.ipcRenderer.invoke('get-settings');
                config.osc = {
                    enabled: settings.oscEnabled || false,
                    host: settings.oscHost || '127.0.0.1',
                    port: settings.oscPort || 3333,
                    receiveEnabled: settings.oscReceiveEnabled || false,
                    receivePort: settings.oscReceivePort || 3334
                };
            } catch (err) {
                console.warn('Could not retrieve OSC settings:', err);
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
            reader.onload = async function (event) {
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

                    // Restore OSC settings if available
                    if (config.osc && window.electron && window.electron.ipcRenderer) {
                        try {
                            await window.electron.ipcRenderer.invoke('update-setting', 'oscEnabled', config.osc.enabled);
                            await window.electron.ipcRenderer.invoke('update-setting', 'oscHost', config.osc.host);
                            await window.electron.ipcRenderer.invoke('update-setting', 'oscPort', config.osc.port);
                            await window.electron.ipcRenderer.invoke('update-setting', 'oscReceiveEnabled', config.osc.receiveEnabled);
                            await window.electron.ipcRenderer.invoke('update-setting', 'oscReceivePort', config.osc.receivePort);

                            // Update UI to reflect loaded OSC settings
                            const oscToggle = document.getElementById('osc-toggle');
                            const oscHost = document.getElementById('osc-host');
                            const oscPort = document.getElementById('osc-port');
                            const oscReceiveToggle = document.getElementById('osc-receive-toggle');
                            const oscReceivePort = document.getElementById('osc-receive-port');

                            if (oscToggle) oscToggle.checked = config.osc.enabled;
                            if (oscHost) oscHost.value = config.osc.host;
                            if (oscPort) oscPort.value = config.osc.port;
                            if (oscReceiveToggle) oscReceiveToggle.checked = config.osc.receiveEnabled;
                            if (oscReceivePort) oscReceivePort.value = config.osc.receivePort;

                            console.log('OSC settings restored');
                        } catch (err) {
                            console.warn('Could not restore OSC settings:', err);
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

    // Helper function for logging
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

    // Settings: Toggle Dynamic Notch
    window.toggleNotchSetting = async function (el) {
        if (!window.electron) return;
        const enabled = el.checked;
        await window.electron.ipcRenderer.invoke('update-setting', 'notchEnabled', enabled);
    };

    // Settings: Toggle Notch Sounds
    window.toggleNotchSoundSetting = async function (el) {
        if (!window.electron) return;
        const enabled = el.checked;
        await window.electron.ipcRenderer.invoke('update-setting', 'notchSoundsEnabled', enabled);
    };

    window.toggleAnalyticsSetting = async function (checkbox) {
        console.log('Toggling Analytics:', checkbox.checked);
        try {
            await window.electron.ipcRenderer.invoke('update-setting', 'analyticsEnabled', checkbox.checked);
        } catch (error) {
            console.error('Failed to update analytics setting:', error);
            // Revert checkbox if failed
            checkbox.checked = !checkbox.checked;
        }
    };

    // Global Error Tracking (Renderer Process)
    window.onerror = function (message, source, lineno, colno, error) {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.invoke('track-event', 'error', {
                process: 'renderer',
                message: message,
                source: source,
                lineno: lineno
            });
        }
    };

    window.onunhandledrejection = function (event) {
        // Prevent infinite loops if the error is about the tracker itself
        const msg = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown';
        if (msg.includes('track-event')) return;

        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.invoke('track-event', 'error', {
                process: 'renderer',
                type: 'unhandledRejection',
                message: msg
            }).catch(err => {
                // Silently fail if tracking fails to avoid loops
                console.warn('[Analytics] Failed to track error:', err);
            });
        }
    };
    // ========================================
    // BROADCAST / OSC MODAL
    // ========================================
    window.openBroadcastModal = async function () {
        const modal = document.getElementById('broadcast-modal');
        if (modal) {
            modal.classList.add('active');
            // Load current settings
            if (window.electron && window.electron.ipcRenderer) {
                const settings = await window.electron.ipcRenderer.invoke('get-settings');
                updateBroadcastUI(settings);
            }
        }
    };

    window.closeBroadcastModal = function () {
        const modal = document.getElementById('broadcast-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    function updateBroadcastUI(settings) {
        const oscToggle = document.getElementById('osc-toggle');
        const oscHost = document.getElementById('osc-host');
        const oscPort = document.getElementById('osc-port');
        const oscReceiveToggle = document.getElementById('osc-receive-toggle');
        const oscReceivePort = document.getElementById('osc-receive-port');
        const configGroup = document.getElementById('osc-config-group');
        const receiveConfigGroup = document.getElementById('osc-receive-config-group');
        const indicator = document.getElementById('osc-status-indicator'); // Added this line to define indicator

        if (oscToggle) oscToggle.checked = settings.oscEnabled;
        if (configGroup) configGroup.style.display = settings.oscEnabled ? 'block' : 'none';

        if (oscHost) oscHost.value = settings.oscHost || '127.0.0.1';
        if (oscPort) oscPort.value = settings.oscPort || 3333;

        if (oscReceiveToggle) oscReceiveToggle.checked = settings.oscReceiveEnabled;
        if (receiveConfigGroup) receiveConfigGroup.style.display = settings.oscReceiveEnabled ? 'block' : 'none';
        if (oscReceivePort) oscReceivePort.value = settings.oscReceivePort || 3334;

        // Update indicator
        if (indicator) {
            const isActive = settings.oscEnabled || settings.oscReceiveEnabled;
            indicator.style.backgroundColor = isActive ? '#10b981' : '#333';
            indicator.style.boxShadow = isActive ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none';
        }
    }

    // Event Listeners for Broadcast Modal
    try {
        const oscToggle = document.getElementById('osc-toggle');
        const oscHost = document.getElementById('osc-host');
        const oscPort = document.getElementById('osc-port');
        const oscReceiveToggle = document.getElementById('osc-receive-toggle');
        const oscReceivePort = document.getElementById('osc-receive-port');

        if (oscToggle) {
            oscToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                console.log('[CLIENT] Toggle OSC clicked. New state:', enabled);

                const configGroup = document.getElementById('osc-config-group');
                const indicator = document.getElementById('osc-status-indicator');

                if (configGroup) configGroup.style.display = enabled ? 'block' : 'none';

                // Update indicator immediately
                if (indicator) {
                    const receiveEnabled = document.getElementById('osc-receive-toggle').checked;
                    const isActive = enabled || receiveEnabled;
                    indicator.style.backgroundColor = isActive ? '#10b981' : '#333';
                    indicator.style.boxShadow = isActive ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none';
                }

                if (window.electron && window.electron.ipcRenderer) {
                    await window.electron.ipcRenderer.invoke('update-setting', 'oscEnabled', enabled);

                    // Trigger Notch Notification
                    if (enabled) {
                        triggerNotch('success', 'Broadcasting OSC', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>`);
                    } else {
                        triggerNotch('disconnect', 'OSC Broadcasting Stopped', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>`);
                    }

                    // Track Event
                    window.electron.ipcRenderer.invoke('track-event', 'osc_broadcast_toggled', {
                        enabled: enabled
                    });
                }
            });
        }

        if (oscReceiveToggle) {
            oscReceiveToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                const receiveGroup = document.getElementById('osc-receive-config-group');
                if (receiveGroup) receiveGroup.style.display = enabled ? 'block' : 'none';

                // Update indicator immediately
                const indicator = document.getElementById('osc-status-indicator');
                if (indicator) {
                    const broadcastEnabled = document.getElementById('osc-toggle').checked;
                    const isActive = enabled || broadcastEnabled;
                    indicator.style.backgroundColor = isActive ? '#10b981' : '#333';
                    indicator.style.boxShadow = isActive ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none';
                }

                if (window.electron && window.electron.ipcRenderer) {
                    await window.electron.ipcRenderer.invoke('update-setting', 'oscReceiveEnabled', enabled);

                    // Trigger Notch Notification
                    if (enabled) {
                        triggerNotch('success', 'Receiving OSC', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>`);
                    } else {
                        triggerNotch('disconnect', 'OSC Receiving Stopped', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>`);
                    }

                    // Track Event
                    window.electron.ipcRenderer.invoke('track-event', 'osc_receive_toggled', {
                        enabled: enabled
                    });
                }
            });
        }

        function saveOSCConfig() {
            const host = document.getElementById('osc-host').value;
            const port = parseInt(document.getElementById('osc-port').value);
            const receivePort = parseInt(document.getElementById('osc-receive-port').value);
            const receiveEnabled = document.getElementById('osc-receive-toggle').checked;

            if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.invoke('update-setting', 'oscHost', host);
                window.electron.ipcRenderer.invoke('update-setting', 'oscPort', port);
                window.electron.ipcRenderer.invoke('update-setting', 'oscReceivePort', receivePort);
                window.electron.ipcRenderer.invoke('update-setting', 'oscReceiveEnabled', receiveEnabled);
            }
        }

        if (oscHost) oscHost.addEventListener('change', saveOSCConfig);
        if (oscPort) oscPort.addEventListener('change', saveOSCConfig);
        if (oscReceivePort) oscReceivePort.addEventListener('change', saveOSCConfig);
    } catch (err) {
        console.error('[CLIENT] Error initializing Broadcast listeners:', err);
    }

})();
