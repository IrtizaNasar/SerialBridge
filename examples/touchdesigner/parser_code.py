import json

# Global state to persist values across frames (prevents flickering)
# Structure: { 'device_id': { 'channel_name': value } }
DEVICE_STATE = {}

def cook(scriptOp):
    """
    Main function called every frame by TouchDesigner
    """
    
    # Get the OSC In DAT
    osc = None
    try:
        osc = op('oscin1')
    except:
        pass
    
    if osc is None:
        try:
            osc = op('oscin')
        except:
            pass
            
    # If still not found, don't process new messages, but still output current state
    # The script should fall through to the output section instead of returning.
    
    # Process new messages
    if osc is not None and osc.numRows > 1:
        for i in range(1, osc.numRows):
            row = osc.row(i)
            if len(row) < 4: continue
            
            device_id = row[2].val
            data_str = row[3].val
            
            # Clean ID
            clean_id = device_id.replace('"', '').replace(' ', '_')
            if clean_id not in DEVICE_STATE:
                DEVICE_STATE[clean_id] = {}
                
            # Clean payload
            if data_str.startswith('"') and data_str.endswith('"'):
                data_str = data_str[1:-1]
                
            try:
                data = json.loads(data_str)
                
                if isinstance(data, dict):
                    # --- MUSE S BATCH HANDLING ---
                    # 1. Flatten Batch into list of packets
                    packets = []
                    if 'samples' in data:
                        # Add all samples from batch
                        packets.extend(data['samples'])
                    else:
                        # Add single packet
                        packets.append(data)
                        
                    # 2. Process all packets in this update
                    for packet in packets:
                        p_type = packet.get('type')
                        p_data = packet.get('data', {})
                        
                        # EEG
                        if p_type == 'eeg':
                            for k, v in p_data.items():
                                DEVICE_STATE[clean_id][f'eeg_{k}'] = v
                                
                        # PPG
                        elif p_type == 'ppg':
                            for k, v in p_data.items():
                                DEVICE_STATE[clean_id][f'ppg_{k}'] = v
                                
                        # IMU (Combined Accel/Gyro)
                        elif p_type == 'imu':
                            if 'accel' in p_data:
                                for k, v in p_data['accel'].items():
                                    DEVICE_STATE[clean_id][f'accel_{k}'] = v
                            if 'gyro' in p_data:
                                for k, v in p_data['gyro'].items():
                                    DEVICE_STATE[clean_id][f'gyro_{k}'] = v
                                    
                        # Legacy/Generic Accel
                        elif p_type in ['accel', 'accelerometer']:
                             for k, v in p_data.items():
                                DEVICE_STATE[clean_id][f'accel_{k}'] = v
                                
                        # Legacy/Generic Gyro
                        elif p_type == 'gyro':
                             for k, v in p_data.items():
                                DEVICE_STATE[clean_id][f'gyro_{k}'] = v
                                
                        # Heart Rate
                        elif p_type == 'heart_rate':
                            DEVICE_STATE[clean_id]['bpm'] = packet.get('bpm', 0)
                            
                # Numeric Fallback
                elif isinstance(data, (int, float)):
                    DEVICE_STATE[clean_id]['value'] = data
                    
            except:
                pass

    # --- OUTPUT TO CHOP ---
    # Always write the FULL state to keep channels alive
    scriptOp.clear()
    scriptOp.numSamples = 1
    
    for dev_id, channels in DEVICE_STATE.items():
        for ch_name, val in channels.items():
            # Create channel name: device_1_eeg_tp9
            full_name = f"{dev_id}_{ch_name}"
            chan = scriptOp.appendChan(full_name)
            chan[0] = val


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
