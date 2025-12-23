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
                
                # iOS Sensor Bridge - Phone Sensors
                elif data_type == 'phone_sensors':
                    # Accelerometer
                    if data.get('accel_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_accel_x')
                        chan[0] = data.get('accel_x', 0)
                    if data.get('accel_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_accel_y')
                        chan[0] = data.get('accel_y', 0)
                    if data.get('accel_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_accel_z')
                        chan[0] = data.get('accel_z', 0)
                    
                    # Gyroscope
                    if data.get('gyro_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gyro_x')
                        chan[0] = data.get('gyro_x', 0)
                    if data.get('gyro_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gyro_y')
                        chan[0] = data.get('gyro_y', 0)
                    if data.get('gyro_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gyro_z')
                        chan[0] = data.get('gyro_z', 0)
                    
                    # Magnetometer
                    if data.get('mag_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_mag_x')
                        chan[0] = data.get('mag_x', 0)
                    if data.get('mag_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_mag_y')
                        chan[0] = data.get('mag_y', 0)
                    if data.get('mag_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_mag_z')
                        chan[0] = data.get('mag_z', 0)
                    
                    # Device Motion (Attitude)
                    if data.get('pitch') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_pitch')
                        chan[0] = data.get('pitch', 0)
                    if data.get('roll') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_roll')
                        chan[0] = data.get('roll', 0)
                    if data.get('yaw') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_yaw')
                        chan[0] = data.get('yaw', 0)
                    
                    # Barometer
                    if data.get('pressure') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_pressure')
                        chan[0] = data.get('pressure', 0)
                    if data.get('altitude') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_altitude')
                        chan[0] = data.get('altitude', 0)
                    
                    # GPS/Location
                    if data.get('latitude') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_latitude')
                        chan[0] = data.get('latitude', 0)
                    if data.get('longitude') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_longitude')
                        chan[0] = data.get('longitude', 0)
                    if data.get('speed') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_speed')
                        chan[0] = data.get('speed', 0)
                    if data.get('heading') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_heading')
                        chan[0] = data.get('heading', 0)
                    
                    # Audio Level
                    if data.get('audio_level') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_audio_level')
                        chan[0] = data.get('audio_level', 0)
                    
                    # Gravity
                    if data.get('gravity_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gravity_x')
                        chan[0] = data.get('gravity_x', 0)
                    if data.get('gravity_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gravity_y')
                        chan[0] = data.get('gravity_y', 0)
                    if data.get('gravity_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_gravity_z')
                        chan[0] = data.get('gravity_z', 0)
                    
                    # User Acceleration
                    if data.get('user_accel_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_user_accel_x')
                        chan[0] = data.get('user_accel_x', 0)
                    if data.get('user_accel_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_user_accel_y')
                        chan[0] = data.get('user_accel_y', 0)
                    if data.get('user_accel_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_user_accel_z')
                        chan[0] = data.get('user_accel_z', 0)
                    
                    # Quaternion
                    if data.get('quat_x') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_quat_x')
                        chan[0] = data.get('quat_x', 0)
                    if data.get('quat_y') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_quat_y')
                        chan[0] = data.get('quat_y', 0)
                    if data.get('quat_z') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_quat_z')
                        chan[0] = data.get('quat_z', 0)
                    if data.get('quat_w') is not None:
                        chan = scriptOp.appendChan(f'{clean_id}_quat_w')
                        chan[0] = data.get('quat_w', 0)
                
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
