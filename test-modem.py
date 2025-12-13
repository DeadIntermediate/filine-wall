#!/usr/bin/env python3
"""
Test script to verify USRobotics modem connection and AT command responses.
This script will:
1. Open the modem serial port (/dev/ttyACM0)
2. Send basic AT commands
3. Enable Caller ID
4. Display modem information
"""

import serial
import time
import sys

def test_modem():
    modem_port = '/dev/ttyACM0'
    baud_rate = 57600
    
    print(f"🔌 Testing modem on {modem_port} at {baud_rate} baud...")
    print("-" * 50)
    
    try:
        # Open serial connection
        ser = serial.Serial(
            port=modem_port,
            baudrate=baud_rate,
            timeout=2,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE
        )
        
        print(f"✅ Successfully opened {modem_port}")
        time.sleep(1)
        
        # Clear any existing data
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Test 1: Reset modem
        print("\n📡 Sending ATZ (reset modem)...")
        ser.write(b'ATZ\r')
        time.sleep(1)
        response = ser.read(ser.in_waiting or 1).decode('utf-8', errors='ignore')
        print(f"   Response: {response.strip()}")
        
        # Test 2: Enable Caller ID
        print("\n📞 Sending AT+VCID=1 (enable Caller ID)...")
        ser.write(b'AT+VCID=1\r')
        time.sleep(1)
        response = ser.read(ser.in_waiting or 1).decode('utf-8', errors='ignore')
        print(f"   Response: {response.strip()}")
        
        # Test 3: Get modem info
        print("\n🔍 Sending ATI (get modem information)...")
        ser.write(b'ATI\r')
        time.sleep(1)
        response = ser.read(ser.in_waiting or 1).decode('utf-8', errors='ignore')
        print(f"   Response: {response.strip()}")
        
        # Test 4: Check if modem is ready
        print("\n✔️  Sending AT (basic check)...")
        ser.write(b'AT\r')
        time.sleep(1)
        response = ser.read(ser.in_waiting or 1).decode('utf-8', errors='ignore')
        print(f"   Response: {response.strip()}")
        
        ser.close()
        
        print("\n" + "=" * 50)
        print("✅ Modem is working!")
        print("=" * 50)
        print("\nNext steps:")
        print("1. Restart FiLine Wall server: npm run dev")
        print("2. Check dashboard for modem status")
        print("3. Setup device-client service: cd device-client && sudo ./setup.sh")
        
        return True
        
    except serial.SerialException as e:
        print(f"\n❌ Serial port error: {e}")
        print("\nTroubleshooting:")
        print("1. Check if you're in the dialout group: groups")
        print("2. Add yourself to dialout: sudo usermod -a -G dialout $USER")
        print("3. Log out and back in, or run: newgrp dialout")
        print("4. Check device exists: ls -l /dev/ttyACM0")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_modem()
