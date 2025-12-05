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

// Advanced Audio Engine (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {};

// 1. Create Static Graph (Once) to prevent lag
// Filter -> Gain -> Destination
const lowPassFilter = audioCtx.createBiquadFilter();
lowPassFilter.type = 'lowpass';
lowPassFilter.frequency.value = 2000; // Soften harshness

const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.15; // 15% Volume

// Connect the permanent graph
lowPassFilter.connect(masterGain);
masterGain.connect(audioCtx.destination);

async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        soundBuffers[name] = audioBuffer;
    } catch (e) {
        console.error(`Failed to load sound ${name}:`, e);
    }
}

// Preload Buffers
loadSound('success', '../assets/sounds/success.wav');
loadSound('error', '../assets/sounds/error.mp3');

function playPolishedSound(bufferName) {
    if (!soundBuffers[bufferName]) return;

    // Resume context if suspended (Chrome/Electron policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Create Source (Lightweight)
    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffers[bufferName];

    // Pitch Randomization
    source.playbackRate.value = 0.98 + Math.random() * 0.04;

    // Connect to existing graph
    source.connect(lowPassFilter);

    // Play
    source.start(0);
}

ipcRenderer.on('trigger-notch', (event, { type, message, icon, soundEnabled }) => {
    console.log('[Notch Renderer] Received trigger. Sound enabled:', soundEnabled);
    // Clear existing timeout
    if (hideTimeout) clearTimeout(hideTimeout);

    const container = document.getElementById('notch'); // Assuming 'notch' is the container
    const msgEl = document.getElementById('message');
    const iconContainer = document.getElementById('icon');

    // Select Icon based on Type/Icon param
    let iconSvg = icons.check; // Default

    if (icon && icon.startsWith('<svg')) {
        // Custom SVG passed directly
        iconSvg = icon;
    } else if (icon === 'bluetooth') {
        iconSvg = icons.bluetooth;
    } else if (type === 'error') {
        iconSvg = icons.x;
    }

    // Update Content
    msgEl.textContent = message;
    iconContainer.innerHTML = iconSvg;

    // Reset Classes
    container.className = 'notch expanded';
    container.classList.add(type); // success, disconnect, error

    // Auto-hide after 5 seconds (Native feel)
    hideTimeout = setTimeout(() => {
        container.classList.remove('expanded');
        container.classList.add('collapsed');
    }, 5000);

    // Play Sound Effect (Polished)
    if (soundEnabled !== false) {
        if (type === 'success' || type === 'bluetooth-success') {
            playPolishedSound('success');
        } else if (type === 'disconnect' || type === 'error') {
            playPolishedSound('error');
        }
    }
});
