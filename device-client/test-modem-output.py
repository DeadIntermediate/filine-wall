#!/usr/bin/env python3
"""
Test script to monitor raw modem output and diagnose caller ID issues.
Run this script and make a test call to see what the modem actually sends.
"""

import serial
import time
import sys
from configparser import ConfigParser

def test_modem():
    # Load config
    config = ConfigParser()
    config.read('/etc/call-detector/config.ini')
    
    device = config["modem"]["device"]
    baud_rate = int(config["modem"].get("baud_rate", "57600"))
    
    print(f"Opening modem on {device} at {baud_rate} baud...")
    print("=" * 60)
    
    try:
        modem = serial.Serial(
            port=device,
            baudrate=baud_rate,
            timeout=1
        )
        
        print("✓ Modem connected successfully")
        print("\nSending initialization commands...")
        
        # Reset modem
        modem.write(b"ATZ\r")
        time.sleep(1)
        response = modem.read(modem.in_waiting).decode(errors='ignore')
        print(f"ATZ Response: {response.strip()}")
        
        # Try different caller ID commands
        commands = [
            "AT+VCID=1",   # Standard voice caller ID
            "AT#CID=1",    # Alternative format
            "AT+CLIP=1",   # Calling Line Identification
        ]
        
        for cmd in commands:
            print(f"\nSending: {cmd}")
            modem.write(f"{cmd}\r".encode())
            time.sleep(0.5)
            if modem.in_waiting:
                response = modem.read(modem.in_waiting).decode(errors='ignore')
                print(f"Response: {response.strip()}")
        
        print("\n" + "=" * 60)
        print("MONITORING FOR CALLS - Make a test call now!")
        print("Press Ctrl+C to stop")
        print("=" * 60 + "\n")
        
        # Monitor for incoming data
        while True:
            if modem.in_waiting:
                data = modem.readline().decode(errors='ignore').strip()
                if data:
                    print(f"[{time.strftime('%H:%M:%S')}] RAW: {repr(data)}")
                    print(f"[{time.strftime('%H:%M:%S')}] TXT: {data}")
                    
                    # Check for common caller ID patterns
                    if any(keyword in data.upper() for keyword in ['NMBR', 'CALLER', 'CLIP', 'RING']):
                        print("    ⚡ POSSIBLE CALLER ID DATA DETECTED!")
                    print()
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if 'modem' in locals():
            modem.close()
            print("Modem closed")

if __name__ == "__main__":
    test_modem()
