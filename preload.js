const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            // Whitelist channels
            let validChannels = ['bluetooth-device-selected', 'bluetooth-device-cancelled', 'show-notch', 'update-setting'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        on: (channel, func) => {
            let validChannels = ['bluetooth-device-list', 'settings-updated', 'osc-error', 'ble-write-request'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        invoke: (channel, ...args) => {
            let validChannels = ['get-settings', 'has-notch', 'update-setting', 'track-event'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
        }
    }
});
