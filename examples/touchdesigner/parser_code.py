import json

def cook(scriptOp):
    """
    Main function called every frame by TouchDesigner
    Supports multiple devices simultaneously
    """
    
    # Get the OSC In DAT
    # Try multiple possible names
    osc = None
    
    # Try oscin1 first (most common)
    try:
        osc = op('oscin1')
    except:
        pass
    
    # Try oscin
    if osc is None:
        try:
            osc = op('oscin')
        except:
            pass
    
    # If still not found, clear and return
    if osc is None:
        scriptOp.clear()
        return
    
    # Check if we have data
    if osc.numRows <= 1:
        scriptOp.clear()
        return
    
    # Build a dictionary of latest data from each device
    # by processing all rows in the OSC In DAT
    device_data = {}
    
    # OSC In DAT format: [message, address, device_id, data]
    for i in range(1, osc.numRows):  # Skip header row (row 0)
        row = osc.row(i)
        
        if len(row) < 4:
            continue
        
        device_id = row[2].val
        data_str = row[3].val
        
        # Strip extra quotes if present
        if data_str.startswith('"') and data_str.endswith('"'):
            data_str = data_str[1:-1]
        
        # Store this device's latest data (will overwrite if multiple messages from same device)
        device_data[device_id] = data_str
    
    # Now create channels for ALL devices
    scriptOp.clear()
    scriptOp.numSamples = 1
    
    for device_id, data_str in device_data.items():
        # Clean device ID for channel naming (remove quotes, spaces, etc.)
        clean_id = device_id.replace('"', '').replace(' ', '_')
        
        # Try to parse as JSON first
        try:
            data = json.loads(data_str)
            
            # It's JSON - parse based on type
            if isinstance(data, dict):
                data_type = data.get('type', 'unknown')
                
                # Heart Rate Monitor
                if data_type == 'heart_rate':
                    chan = scriptOp.appendChan(f'{clean_id}_bpm')
                    chan[0] = data.get('bpm', 0)
                    
                    rr = data.get('rr_intervals', [])
                    if rr:
                        for i, interval in enumerate(rr[:4]):
                            chan = scriptOp.appendChan(f'{clean_id}_rr_{i}')
                            chan[0] = interval
                
                # Muse 2 EEG
                elif data_type == 'eeg':
                    for name, value in data.get('data', {}).items():
                        chan = scriptOp.appendChan(f'{clean_id}_eeg_{name}')
                        chan[0] = value
                
                # Muse 2 PPG
                elif data_type == 'ppg':
                    for name, value in data.get('data', {}).items():
                        chan = scriptOp.appendChan(f'{clean_id}_ppg_{name}')
                        chan[0] = value
                
                # Muse 2 Accelerometer
                elif data_type in ['accel', 'accelerometer']:
                    for axis, value in data.get('data', {}).items():
                        chan = scriptOp.appendChan(f'{clean_id}_accel_{axis}')
                        chan[0] = value
                
                # Muse 2 Gyroscope
                elif data_type == 'gyro':
                    for axis, value in data.get('data', {}).items():
                        chan = scriptOp.appendChan(f'{clean_id}_gyro_{axis}')
                        chan[0] = value
                
                # Generic JSON - flatten all numeric values
                else:
                    flatten_json(data, scriptOp, prefix=clean_id)
            
            # JSON parsed successfully but it's just a number
            elif isinstance(data, (int, float)):
                chan = scriptOp.appendChan(f'{clean_id}_value')
                chan[0] = data
        
        except (json.JSONDecodeError, ValueError):
            # Not JSON - treat as simple numeric value
            try:
                value = float(data_str)
                chan = scriptOp.appendChan(f'{clean_id}_value')
                chan[0] = value
            except ValueError:
                # Not a number - output 0
                chan = scriptOp.appendChan(f'{clean_id}_value')
                chan[0] = 0


def flatten_json(data, scriptOp, prefix=''):
    """
    Recursively flatten JSON into CHOP channels
    """
    if isinstance(data, dict):
        for key, value in data.items():
            new_key = f'{prefix}_{key}' if prefix else key
            if isinstance(value, (int, float)):
                chan = scriptOp.appendChan(new_key)
                chan[0] = value
            elif isinstance(value, dict):
                flatten_json(value, scriptOp, new_key)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, (int, float)):
                        chan = scriptOp.appendChan(f'{new_key}_{i}')
                        chan[0] = item
