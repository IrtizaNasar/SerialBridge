// --- CONFIGURATION ---
// Calculates Alpha Asymmetry to estimate emotional valence.
// Left Hemisphere Activation = Positive/Approach
// Right Hemisphere Activation = Negative/Withdrawal

let socket;

// Variables to store the "Power" (Strength) of Alpha waves
let alphaLeft = 0;
let alphaRight = 0;

// Filters to isolate Alpha waves (8-13Hz)
// State variables for IIR filter
let filterLeft = { inputHistory: [], outputHistory: [] };
let filterRight = { inputHistory: [], outputHistory: [] };

// Calibration variables (to find your "Normal" zero)
let isCalibrating = false;
let calibrationData = []; // Stores scores while calibrating
let calibrationOffset = 0; // The average score we subtract
let calibrationTimer = 0;

// Visualization variables
let moodScore = 0;
let smoothMoodScore = 0;
let moodBuffer = []; // Stores last 5 seconds of data

// Connection Config
const DEVICE_ID = 'device_1'; // Default ID. Change this if you renamed it!

function setup() {
    createCanvas(windowWidth, windowHeight);

    // Connect using the Serial Bridge Wrapper
    // Auto-connects to http://localhost:3000
    let bridge = new SerialBridge();

    // Listen for data from specific device ID
    bridge.onData(DEVICE_ID, function (data) {
        processIncomingData({ data: data });
    });

    // Create a simple button for calibration
    let btn = createButton('CALIBRATE (Sit Still)');
    btn.position(width / 2 - 75, height - 80);
    btn.size(150, 40);
    btn.style('font-size', '16px');
    btn.style('cursor', 'pointer');

    // When button is clicked, run this function
    btn.mousePressed(startCalibration);
}

// --- 2. UNIVERSAL CALIBRATION FUNCTION ---
// (Matches the README documentation)
function calibrate(currentValue, mode = 'offset') {
    // If not calibrating and no baseline, return raw value (or 0)
    if (!isCalibrating && calibrationOffset === 0) return currentValue;

    // A. Collection Phase
    if (isCalibrating) {
        calibrationData.push(currentValue);

        // Stop after 300 samples (~5 seconds)
        if (calibrationData.length > 300) {
            isCalibrating = false;

            // Calculate Average
            let sum = 0;
            for (let i = 0; i < calibrationData.length; i++) {
                sum = sum + calibrationData[i];
            }
            calibrationOffset = sum / calibrationData.length;
            print("Calibration Complete! Baseline: " + calibrationOffset);
        }
        return 0; // Return neutral during calibration
    }

    // B. Application Phase
    if (mode === 'ratio') {
        return currentValue / calibrationOffset; // For fNIRS
    } else {
        return currentValue - calibrationOffset; // For Mood/EEG
    }
}

function startCalibration() {
    isCalibrating = true;
    calibrationData = [];
    calibrationOffset = 0;
    print("Starting Calibration...");
}

function draw() {
    background(40);

    // 1. Calculate Raw Score
    let rawScore = Math.log(alphaRight + 0.1) - Math.log(alphaLeft + 0.1);

    // 2. Apply Calibration (Universal Method)
    // We use 'offset' mode because this is an Index/Score
    let finalScore = calibrate(rawScore, 'offset');

    // --- 3. TRAILING AVERAGE (STABLE MOOD) ---
    // Push the instant score to our rolling window
    if (!isCalibrating) {
        moodBuffer.push(finalScore);

        // Keep last 5 Seconds (300 frames at 60fps)
        if (moodBuffer.length > 300) {
            moodBuffer.shift(); // Remove oldest
        }

        // Calculate the Average of the window
        let sum = 0;
        for (let i = 0; i < moodBuffer.length; i++) {
            sum += moodBuffer[i];
        }
        let averageScore = sum / moodBuffer.length;

        // Use this stable average for the UI
        smoothMoodScore = averageScore;
    } else {
        smoothMoodScore = 0; // Reset during calibration
        moodBuffer = [];
    }

    // Limit bounds
    if (smoothMoodScore > 2) smoothMoodScore = 2;
    if (smoothMoodScore < -2) smoothMoodScore = -2;

    // --- DRAWING THE UI ---
    translate(width / 2, height / 2);
    textAlign(CENTER);
    noStroke();

    // Title
    fill(255);
    textSize(30);
    text("Mood Meter", 0, -150);

    // Status Text
    textSize(20);
    if (isCalibrating) {
        fill(255, 200, 0);
        text("CALIBRATING... " + Math.round((calibrationData.length / 300) * 100) + "%", 0, -100);
    } else {
        fill(150);
        text("Green = Positive | Red = Negative", 0, -110);
    }

    // Draw Bar
    let barSize = map(smoothMoodScore, -1, 1, -300, 300);

    // Color Logic
    if (smoothMoodScore > 0.1) {
        fill(50, 255, 100); text("POSITIVE MOOD", 0, 100);
    } else if (smoothMoodScore < -0.1) {
        fill(255, 50, 100); text("NEGATIVE MOOD", 0, 100);
    } else {
        fill(200); text("NEUTRAL", 0, 100);
    }

    fill(60);
    rectMode(CENTER);
    rect(0, 0, 600, 40, 20); // Track

    if (!isCalibrating) {
        fill(smoothMoodScore > 0 ? 'green' : 'red');
        rect(barSize / 2, 0, Math.abs(barSize), 40, 20);
    }

    // Debug
    fill(100);
    textSize(24);
    textAlign(LEFT, TOP);
    text("Listening to: " + DEVICE_ID, -width / 2 + 20, -height / 2 + 20);

    textSize(12);
    textAlign(CENTER);
    text("Raw Alpha Left: " + alphaLeft.toFixed(1), -200, 180);
    text("Raw Alpha Right: " + alphaRight.toFixed(1), 200, 180);
}

// --- DATA PROCESSING ---

function processIncomingData(payload) {
    if (!payload.data) return;

    // Sometimes data comes as a text string, we need to convert it to an Object
    let packet = payload.data;
    if (typeof packet === 'string') {
        try {
            packet = JSON.parse(packet);
        } catch (e) {
            return; // If it's broken text, ignore it
        }
    }

    // Check if it is EEG data (type 'eeg')
    if (packet.type === 'eeg') {

        // Process batched samples (standard for Muse S high-frequency mode)
        if (packet.samples) {
            // Loop through all samples in the batch
            for (let i = 0; i < packet.samples.length; i++) {
                let sample = packet.samples[i];

                // We only care about EEG samples inside
                if (sample.type === 'eeg' && sample.rawSamples) {
                    processBatchOfNumbers('af7', sample.rawSamples['af7']);
                    processBatchOfNumbers('af8', sample.rawSamples['af8']);
                }
            }
        }
    }
}

// Helper: Handle a list of numbers for a specific channel/sensor
function processBatchOfNumbers(channelName, numbers) {
    if (!numbers) return;

    // Loop through the numbers
    for (let i = 0; i < numbers.length; i++) {
        let value = numbers[i];

        // 1. Filter the raw data to get only Alpha waves
        let alphaValue = runBandpassFilter(value, channelName);

        // 2. Safety check for filter stability
        if (isNaN(alphaValue)) {
            resetFilter(channelName);
            return;
        }

        // 3. Power Calculation & Smoothing
        // Square amplitude to get power, then apply exponential moving average
        let energy = alphaValue * alphaValue;

        if (channelName === 'af7') {
            // Update Left Alpha (Strong Smoothing: 99.5% old, 0.5% new)
            alphaLeft = (alphaLeft * 0.995) + (energy * 0.005);
        } else {
            // Update Right Alpha (Strong Smoothing)
            alphaRight = (alphaRight * 0.995) + (energy * 0.005);
        }
    }
}


// --- SIGNAL PROCESSING ---

// Apply 4th-order Biquad Bandpass Filter (8-13Hz)
function runBandpassFilter(input, channel) {
    // Get the memory for this channel
    let f = (channel === 'af7') ? filterLeft : filterRight;

    // Initialize memory if empty
    if (f.inputHistory.length === 0) {
        f.inputHistory = [0, 0];
        f.outputHistory = [0, 0];
    }

    // Biquad coefficients for 8-13Hz Bandpass @ 256Hz sampling
    let b0 = 0.057;
    let b1 = 0.0;
    let b2 = -0.057;
    let a1 = -1.79;
    let a2 = 0.885;

    // Connect variables to simple names
    let x = input;
    let x1 = f.inputHistory[0];
    let x2 = f.inputHistory[1];
    let y1 = f.outputHistory[0];
    let y2 = f.outputHistory[1];

    // The Filter Formula
    let result = (b0 * x) + (b1 * x1) + (b2 * x2) - (a1 * y1) - (a2 * y2);

    // Save history for next time
    f.inputHistory[1] = f.inputHistory[0];
    f.inputHistory[0] = x;

    f.outputHistory[1] = f.outputHistory[0];
    f.outputHistory[0] = result;

    return result;
}

function resetFilter(channel) {
    let f = (channel === 'af7') ? filterLeft : filterRight;
    f.inputHistory = [0, 0];
    f.outputHistory = [0, 0];
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
