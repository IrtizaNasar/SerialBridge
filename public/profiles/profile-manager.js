/**
 * Device Profile Manager
 * Handles registration of BLE device profiles.
 */

window.DEVICE_PROFILES = {};

window.registerProfile = function (key, profile) {
    if (window.DEVICE_PROFILES[key]) {
        console.warn(`Profile '${key}' is already registered. Overwriting.`);
    }
    window.DEVICE_PROFILES[key] = profile;
    console.log(`Registered profile: ${profile.name}`);
};
