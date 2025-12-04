const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

const defaultSettings = {
    notchEnabled: true,
    notchSoundsEnabled: false,
    analyticsEnabled: true
};

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            return { ...defaultSettings, ...JSON.parse(data) };
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return defaultSettings;
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

function updateSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
    return settings;
}

module.exports = {
    loadSettings,
    saveSettings,
    updateSetting
};
