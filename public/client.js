(function () {
    console.log('Serial Bridge JavaScript loading...');

    const socket = io();
    let connections = {};

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

    // Validate and update connection ID
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

        const portSelect = document.getElementById('port_' + oldId);
        if (portSelect) {
            portSelect.id = 'port_' + newId;
            portSelect.setAttribute('name', 'port_' + newId);
        }

        const connectBtn = document.getElementById('connect_' + oldId);
        if (connectBtn) connectBtn.id = 'connect_' + newId;

        const dataPreview = document.getElementById('data_' + oldId);
        if (dataPreview) dataPreview.id = 'data_' + newId;

        const idInput = document.getElementById('id_input_' + oldId);
        if (idInput) idInput.id = 'id_input_' + newId;

        // Update onclick handlers
        if (card) {
            const refreshBtn = card.querySelector('[onclick*="refreshPorts"]');
            if (refreshBtn) refreshBtn.setAttribute('onclick', 'window.refreshPorts(\'' + newId + '\')');

            const toggleBtn = card.querySelector('[onclick*="toggleConnection"]');
            if (toggleBtn) toggleBtn.setAttribute('onclick', 'window.toggleConnection(\'' + newId + '\')');

            const removeBtn = card.querySelector('[onclick*="removeConnection"]');
            if (removeBtn) removeBtn.setAttribute('onclick', 'window.removeConnection(\'' + newId + '\')');

            const editBtn = card.querySelector('[onclick*="editConnectionId"]');
            if (editBtn) editBtn.setAttribute('onclick', 'window.editConnectionId(\'' + newId + '\')');
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

        // Handle Enter key to save
        idInput.onkeydown = function (e) {
            if (e.key === 'Enter') {
                const newValue = idInput.value;
                if (window.updateConnectionId(id, newValue)) {
                    idInput.disabled = true;
                } else {
                    idInput.value = oldValue;
                }
            } else if (e.key === 'Escape') {
                idInput.value = oldValue;
                idInput.disabled = true;
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

    console.log('Serial Bridge JavaScript loaded successfully');

})();
