const { ipcRenderer } = require('electron');

const notch = document.getElementById('notch');
const iconEl = document.getElementById('icon');
const messageEl = document.getElementById('message');

let hideTimeout;

// Icons
const icons = {
    // USB-C Port (Connect/Success) - Matches user reference
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="5"></rect><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,

    // Crisp X (Disconnect/Error)
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,

    // Bluetooth (Minimal Line Art)
    bluetooth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline></svg>`
};

ipcRenderer.on('trigger-notch', (event, { type, message, icon }) => {
    // Clear existing timeout
    if (hideTimeout) clearTimeout(hideTimeout);

    const notch = document.getElementById('notch');
    const msgEl = document.getElementById('message');
    const iconContainer = document.getElementById('icon');

    // Select Icon based on Type/Icon param
    let iconSvg = icons.check; // Default

    if (icon === 'bluetooth') {
        iconSvg = icons.bluetooth;
    } else if (type === 'error') {
        iconSvg = icons.x;
    }

    // Update Content
    msgEl.textContent = message;
    iconContainer.innerHTML = iconSvg;

    // Reset Classes
    notch.className = 'notch expanded';
    notch.classList.add(type); // success, disconnect, error

    // Auto-hide after 3 seconds
    hideTimeout = setTimeout(() => {
        notch.classList.remove('expanded');
        notch.classList.add('collapsed');
    }, 3000);
});
