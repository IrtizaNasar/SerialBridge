const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

let notchWindow;
let repositionNotch; // Define globally for enable/disable access
let getInternalDisplay; // Define globally

/**
 * Checks if the current Mac has a physical notch.
 * Returns true for MacBookPro18,x (M1 Pro/Max), MacBookAir11,x (M2 Air) and later.
 */
const hasNotch = () => {
    if (process.platform !== 'darwin') return false;

    try {
        const model = execSync('sysctl -n hw.model').toString().trim();

        // Known notch models:
        // MacBookPro18,x (M1 Pro/Max 14/16")
        // MacBookPro14,x (M2/M3 Pro/Max)
        // MacBookAir11,x (M2 Air)
        // MacBookAir14,x (M3 Air)

        // Simple regex for models known to have notches
        if (/^MacBookPro(1[8-9]|[2-9]\d),/.test(model)) return true; // MacBookPro18,x and later
        if (/^MacBookAir(1[1-9]|[2-9]\d),/.test(model)) return true; // MacBookAir11,x and later

        return false;
    } catch (e) {
        console.error('Failed to check Mac model:', e);
        return false;
    }
};

/**
 * Triggers the notch notification
 */
function showNotch(type, message, icon) {
    if (!hasNotch()) return; // Safety check
    if (notchWindow && !notchWindow.isDestroyed()) {
        notchWindow.webContents.send('trigger-notch', { type, message, icon });
    }
}

/**
 * Initializes the Dynamic Notch feature if hardware is compatible.
 * @param {Electron.IpcMain} ipcMain 
 */
function initNotch(ipcMain, shouldEnable = true) {
    // 1. Hardware Check
    if (!hasNotch()) {
        console.log('[Notch] Hardware not compatible (No notch or not macOS). Feature disabled.');
        return;
    }
    if (!hasNotch()) {
        console.log('[Notch] Hardware not compatible or not a Mac. Skipping.');
        return;
    }

    console.log('[Notch] Compatible Mac detected. Initializing...');

    // 2. Register IPC Handler
    ipcMain.on('show-notch', (event, { type, message, icon }) => {
        showNotch(type, message, icon);
    });

    // 3. Delayed Window Creation
    // Wait for main window to be created first (1000ms in main.js)
    // We wait 2000ms here to ensure app icon is established.
    // Helper to find the built-in display
    // Helper to find the built-in display
    // Made global to scope so enableNotch can use it
    getInternalDisplay = () => {
        const displays = screen.getAllDisplays();
        // 1. Try to find explicit 'internal' flag (newer Electron)
        const internal = displays.find(d => d.internal === true);
        if (internal) return internal;

        // 2. Fallback: Look for common internal display labels
        const builtIn = displays.find(d => {
            const label = (d.label || '').toLowerCase();
            return label.includes('built-in') ||
                label.includes('color lcd') ||
                label.includes('liquid retina');
        });
        if (builtIn) return builtIn;

        return null;
    };

    let debounceTimer;
    repositionNotch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try {
                if (!notchWindow || notchWindow.isDestroyed()) return;

                const targetDisplay = getInternalDisplay();

                if (!targetDisplay) {
                    if (notchWindow.isVisible()) {
                        console.log('[Notch] No internal display found (Clamshell mode?). Hiding notch.');
                        notchWindow.hide();
                    }
                    return;
                }

                const { x, y, width } = targetDisplay.bounds;
                const windowWidth = 600;
                const newX = x + Math.round((width - windowWidth) / 2);
                const newY = y; // Top of the target display

                notchWindow.setPosition(newX, newY);
                notchWindow.setSize(windowWidth, 200);

                // Ensure it's visible if we found a display (e.g. lid opened)
                if (!notchWindow.isVisible()) {
                    console.log('[Notch] Internal display detected. Showing notch.');
                    notchWindow.setSkipTaskbar(true);
                    notchWindow.showInactive();
                }
            } catch (error) {
                console.error('[Notch] Error repositioning notch:', error);
            }
        }, 500); // Debounce by 500ms to handle burst events
    };

    // Handle display changes immediately
    // Handle display changes immediately
    // screen.on('display-metrics-changed', repositionNotch); // Moved to enableNotch
    // screen.on('display-added', repositionNotch);
    // screen.on('display-removed', repositionNotch);

    // 3. Delayed Window Creation
    // Wait for main window to be created first (1000ms in main.js)
    // We wait 2000ms here to ensure app icon is established.
    setTimeout(() => {
        if (shouldEnable) {
            enableNotch();
        }
    }, 2000);
}

function createNotchWindow() {
    if (notchWindow && !notchWindow.isDestroyed()) return; // Already active

    console.log('[Notch] Enabling notch...');

    // Force Dock to be visible immediately
    if (process.platform === 'darwin') {
        app.dock.show();
    }

    // Create the browser window
    notchWindow = new BrowserWindow({
        width: 600,
        height: 200,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        show: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        backgroundColor: '#00000000',
        type: 'panel', // Helps with floating behavior on macOS
        fullscreenable: false, // Critical: prevents the window from trying to be a space itself
        title: '' // Explicitly empty title to prevent "serial-bridge" in Dock menu
    });

    notchWindow.loadFile(path.join(__dirname, 'public', 'notch.html'));

    notchWindow.once('ready-to-show', () => {
        // Force Dock to stay visible (fix for panel type hiding it)
        if (process.platform === 'darwin') app.dock.show();

        // Configure for fullscreen visibility ONCE
        notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        notchWindow.setAlwaysOnTop(true, 'screen-saver', 1);

        if (typeof notchWindow.setExcludedFromWindowsMenu === 'function') {
            notchWindow.setExcludedFromWindowsMenu(true);
        }

        // Initial Position
        repositionNotch();

        // Small delay to ensure CSS is fully parsed and transparency is active
        setTimeout(() => {
            // Only show if we have a valid target display
            if (getInternalDisplay()) {
                notchWindow.setSkipTaskbar(true); // Ensure it stays out of Dock
                notchWindow.showInactive();
            }
        }, 100);
    });
}

const enableNotch = () => {
    if (!hasNotch()) return;
    if (notchWindow && !notchWindow.isDestroyed()) return; // Already active

    createNotchWindow();

    // Re-attach listeners
    screen.on('display-metrics-changed', repositionNotch);
    screen.on('display-added', repositionNotch);
    screen.on('display-removed', repositionNotch);

    // Initial positioning
    repositionNotch();
};

const disableNotch = () => {
    if (notchWindow && !notchWindow.isDestroyed()) {
        notchWindow.close();
        notchWindow = null;
    }

    // Remove listeners to free resources
    screen.removeListener('display-metrics-changed', repositionNotch);
    screen.removeListener('display-added', repositionNotch);
    screen.removeListener('display-removed', repositionNotch);
};

module.exports = { initNotch, showNotch, enableNotch, disableNotch, hasNotch };
