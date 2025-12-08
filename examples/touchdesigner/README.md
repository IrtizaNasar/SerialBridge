# TouchDesigner Integration

Drag-and-drop OSC integration for Serial Bridge. Automatically parses data from all connected devices (Heart Rate Monitors, Arduino, Muse 2, etc.) into CHOP channels.

## Quick Start

1. **Download** [`SerialBridge_TD.tox`](SerialBridge_TD.tox)
2. **Drag into TouchDesigner**
3. **Done!** All device data appears as CHOP channels

## Component Overview

The `SerialBridge_TD.tox` is a **container component**. After dragging it into your project, you'll see a box labeled `SerialBridge_TD`.

**To view/edit internal nodes:** Double-click the component. **To go back:** Press `U`.

### Internal Network

- **oscin1**: OSC In DAT receiving on port `3333`
- **script1**: Parser that creates channels for all devices
- **select1**: Optional channel filter
- **OUT**: Final output

## Inside the Container

> **Note:** All the following steps require you to **double-click the component** to go inside first. **To exit the container, press `U`** at any time.

### Configure OSC Port (Optional)

Default port is `3333`. To change:

1. Click `oscin1` (OSC In DAT)
2. Change **Port** parameter

### Update Parser Code (Recommended)

> **Note:** The parser code in the component was last updated **8.12.25**. For the latest code that works with updated device profiles, update from `parser_code.py`.

**To update:**

1. Open [`parser_code.py`](parser_code.py) in a text editor
2. **Select all** and **copy** the code
3. In TouchDesigner, click `script1_callbacks1` (Text DAT)
4. Click the **Edit** button (opens text editor)
5. **Select all** (Cmd+A / Ctrl+A) and **delete**
6. **Paste** the new code
7. **Close** the editor window

### Filter Channels

To filter which channels appear:

1. Click `select1`
2. Set **Channel Names** parameter (see filter examples below)

### View All Channels

To see what channels are being created:

1. Click `script1` to see all parsed channels
2. **Option+Click** `script1` to open channel viewer

## Channel Names

The parser creates channels with device ID prefixes:

### Heart Rate Monitor
- `device_1_bpm` - Heart rate in BPM
- `device_1_rr_0`, `device_1_rr_1`, etc. - RR intervals

### Arduino / Simple Sensors
- `device_2_value` - Numeric sensor value

### Muse 2 EEG
- `device_3_eeg_tp9`, `device_3_eeg_af7`, `device_3_eeg_af8`, `device_3_eeg_tp10`
- `device_3_ppg_ch1`, `device_3_ppg_ch2`, `device_3_ppg_ch3`
- `device_3_accel_x`, `device_3_accel_y`, `device_3_accel_z`
- `device_3_gyro_x`, `device_3_gyro_y`, `device_3_gyro_z`

**Note:** Device IDs (`device_1`, `device_2`, etc.) come from Serial Bridge connection names.

## Channel Filter Examples

| Filter | Result |
|--------|--------|
| `*` | All channels from all devices |
| `device_1_*` | All channels from device_1 |
| `*_bpm` | BPM from all heart rate monitors |
| `device_2_value` | Only Arduino value from device_2 |
| `device_1_bpm device_2_value` | Multiple specific channels |

### Wildcard Patterns

- `*` = Match any characters
- `device_1_*` = All channels starting with `device_1_`
- `*_bpm` = All channels ending with `_bpm`
- `*eeg*` = All channels containing `eeg`

## Using the Output

Wire the component output to any CHOP operator:

```
SerialBridge_TD → Trail CHOP (visualize over time)
SerialBridge_TD → Math CHOP (process values)
SerialBridge_TD → CHOP to TOP (convert to visual)
```

## Multi-Device Support

The component automatically handles multiple devices:

- Each device gets its own set of channels
- No flickering or channel conflicts
- All devices update simultaneously

**Example with 3 devices:**
- Heart Rate Monitor (device_1): `device_1_bpm`, `device_1_rr_0`
- Arduino (device_2): `device_2_value`
- Muse 2 (device_3): `device_3_eeg_tp9`, `device_3_ppg_ch1`, etc.

## Troubleshooting

**No channels appearing?**
1. Check Serial Bridge OSC Broadcasting is enabled (green dot)
2. Verify port matches (default: `3333`)
3. Confirm devices are connected in Serial Bridge

**Wrong device IDs?**
- Device IDs come from Serial Bridge connection names
- Rename connections in Serial Bridge to get cleaner channel names

**Need to update parser?**
- Copy code from `parser_code.py`
- Paste into `script1_callbacks1` inside the component

## Technical Details

- **OSC Protocol**: UDP on localhost
- **Default Port**: 3333
- **Message Format**: `/serial <device_id> <data>`
- **Data Types**: JSON objects or simple numeric values
- **Update Rate**: Real-time (every frame)

## Support

For issues or questions:
- [Serial Bridge GitHub](https://github.com/IrtizaNasar/SerialBridge)
- [Main README](../../README.md)
