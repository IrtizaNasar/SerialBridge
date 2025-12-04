
const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

const { loadSettings } = require('./settings-manager');
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
/**
 */
function showNotch(type, message, icon) {
    // Safety check: If notch is disabled or window destroyed, do nothing.
    if (!notchWindow || notchWindow.isDestroyed()) return;



    const targetDisplay = getInternalDisplay();
    if (!targetDisplay) {
        console.log('[Notch] No internal display found');
        return;
    }

    // 1. Move On-Screen and Resize
    try {
        const { x, y, width } = targetDisplay.bounds;
        const expandedWidth = 600;
        const expandedHeight = 200;
        const newX = x + Math.round((width - expandedWidth) / 2);

        // Check if we actually need to move/resize to avoid visual glitches
        const currentBounds = notchWindow.getBounds();
        const needsMove = !notchWindow.isVisible() ||
            currentBounds.x !== newX ||
            currentBounds.y !== y ||
            currentBounds.width !== expandedWidth ||
            currentBounds.height !== expandedHeight;

        if (needsMove) {
            notchWindow.setBounds({
                x: newX,
                y: y, // Position at top of screen (Attached Style)
                width: expandedWidth,
                height: expandedHeight
            });
        }

        // Force Dock to stay visible (Safety for Panel type)
        if (process.platform === 'darwin') app.dock.show();

        // Ensure visible and click-through
        notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        notchWindow.setAlwaysOnTop(true, 'pop-up-menu'); // 'pop-up-menu' works best with skipTaskbar

        // Always show inactive to ensure it's visible and on top
        notchWindow.showInactive();

        // CRITICAL: Must forward events to window below!
        notchWindow.setIgnoreMouseEvents(true, { forward: true });
    } catch (e) {
        console.error('[Notch] Error resizing for show:', e);
    }

        if (notchWindow && !notchWindow.isDestroyed()) {
            const settings = loadSettings();
            console.log('[Notch] Triggering notch. Sound enabled:', settings.notchSoundsEnabled);
            notchWindow.webContents.send('trigger-notch', { 
                type, 
                message, 
                icon, 
                soundEnabled: settings.notchSoundsEnabled 
            });
        }

    // 2. Schedule Hide (Off-Screen)
    // Clear any existing timeout to prevent premature hiding
    if (global.notchHideTimeout) clearTimeout(global.notchHideTimeout);

    global.notchHideTimeout = setTimeout(() => {
        if (notchWindow && !notchWindow.isDestroyed()) {
            try {
                // Move OFF-SCREEN (Don't hide, keep renderer hot)
                const { x } = targetDisplay.bounds;
                notchWindow.setPosition(x, -10000);
                notchWindow.setSize(1, 1); // Minimize footprint
                // notchWindow.hide(); // REMOVED: Causes lag on next show
            } catch (e) {
                console.error('[Notch] Error hiding:', e);
            }
        }
    }, 5500); // Slightly longer than the client-side 5000ms hide timeout
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

    console.log('[Notch] Compatible Mac detected. Initializing...');

    // 2. Register IPC Handler
    ipcMain.on('show-notch', (event, { type, message, icon }) => {
        showNotch(type, message, icon);
    });

    // 3. Delayed Window Creation
    // Wait for main window to be created first (1000ms in main.js)
    // We wait 2000ms here to ensure app icon is established.
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

                // If the window is currently hidden (idle), keep it off-screen!
                if (!notchWindow.isVisible()) {
                    notchWindow.setPosition(x, -10000);
                    notchWindow.setSize(1, 1); // Minimize footprint
                    return;
                }

                // If visible, update its position on screen
                const windowWidth = 600; // Expanded width
                const windowHeight = 200;
                const newX = x + Math.round((width - windowWidth) / 2);
                const newY = y;

                notchWindow.setPosition(newX, newY);
                notchWindow.setSize(windowWidth, windowHeight);

                // CRITICAL: Re-apply click-through after move/resize
                notchWindow.setIgnoreMouseEvents(true, { forward: true });
            } catch (error) {
                console.error('[Notch] Error repositioning notch:', error);
            }
        }, 500); // Debounce by 500ms to handle burst events
    };

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
    // ARCHITECTURE NOTE:
    // This configuration is the result of extensive testing to solve specific macOS behaviors:
    // 1. type: 'panel' -> Required to float over fullscreen apps (VS Code, etc.) without being hidden.
    // 2. skipTaskbar: true -> Critical! Decouples the window from the main app's "Space".
    //    Without this, showing the notch forces macOS to switch back to the Desktop space.
    // 3. app.dock.show() -> The Counter-Move. 'skipTaskbar: true' on a Panel often hides the Main App's Dock icon.
    //    We explicitly call app.dock.show() in showNotch() to force the icon to stay visible.
    // 4. focusable: false -> Ensures the notification never steals keyboard focus.
    // 5. y + 30 -> Positions the window exactly below the hardware notch (approx 30px height).
    notchWindow = new BrowserWindow({
        width: 160,
        height: 50,
        x: 0,
        y: -1000, // Start OFF-SCREEN
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        backgroundColor: '#00000000',
        type: 'panel', // RESTORED: Needed for correct layering (fixes "screenshot but invisible" bug)
        focusable: false, // Critical: Never take focus
        // vibrancy: 'hud', // REMOVED: Caused gray box
        skipTaskbar: true, // CRITICAL: Fixes "Space Switch" issue. Decouples window from main app space.
        hiddenInMissionControl: true, // REQUIRED: Allows floating over fullscreen apps
        fullscreenable: false, // Critical: Prevent window from becoming a space
        enableLargerThanScreen: true, // Allow positioning off-screen
        title: '' // Explicitly empty title to prevent "serial-bridge" in Dock menu
    });

    // CRITICAL: Ignore all mouse events PERMANENTLY.
    // The notch is a passive visual indicator. It should NEVER block clicks.
    notchWindow.setIgnoreMouseEvents(true, { forward: true });

    notchWindow.loadFile(path.join(__dirname, 'public', 'notch.html'));

    notchWindow.once('ready-to-show', () => {
        // Force Dock to stay visible (fix for panel type hiding it)
        if (process.platform === 'darwin') {
            app.dock.show();
            app.setActivationPolicy('regular'); // CRITICAL: Prevent app from becoming "Accessory"
        }

        // Configure for fullscreen visibility ONCE
        notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        notchWindow.setAlwaysOnTop(true, 'screen-saver', 1);

        if (typeof notchWindow.setExcludedFromWindowsMenu === 'function') {
            notchWindow.setExcludedFromWindowsMenu(true);
        }

        // Initial Position
        repositionNotch();

        // CRITICAL: Show immediately but off-screen to keep renderer "hot"
        // This prevents the "first connect lag" by ensuring the window is already painted.
        notchWindow.showInactive();
    });
}

const enableNotch = () => {
    if (!hasNotch()) return;

    // Force recreation to ensure latest options are applied
    if (notchWindow && !notchWindow.isDestroyed()) {
        notchWindow.close();
    }

    createNotchWindow();

    // Re-attach listeners
    screen.on('display-metrics-changed', repositionNotch);
    screen.on('display-added', repositionNotch);
    screen.on('display-removed', repositionNotch);

    // Initial positioning
    repositionNotch();
};

const disableNotch = () => {
    console.log('[Notch] Disabling notch...');
    try {
        if (notchWindow) {
            if (!notchWindow.isDestroyed()) {
                console.log('[Notch] Closing notch window.');
                notchWindow.close();
            } else {
                console.log('[Notch] Notch window was already destroyed.');
            }
            notchWindow = null;
        } else {
            console.log('[Notch] No notch window to close.');
        }

        // Remove listeners to free resources
        if (repositionNotch) {
            screen.removeListener('display-metrics-changed', repositionNotch);
            screen.removeListener('display-added', repositionNotch);
            screen.removeListener('display-removed', repositionNotch);
        }
    } catch (e) {
        console.error('[Notch] Error disabling notch:', e);
    }
};

module.exports = { initNotch, showNotch, enableNotch, disableNotch, hasNotch };
