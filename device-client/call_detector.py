import os
import sys
import time
import json
import signal
import logging
import requests
import serial
from datetime import datetime
from configparser import ConfigParser
from encryption import DeviceEncryption

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/call-detector.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

class CallDetector:
    def __init__(self):
        self.config = self._load_config()
        self.running = True
        self.session = requests.Session()
        self.modem = None

        # Initialize encryption with auth token and device ID
        self.encryption = DeviceEncryption(
            self.config["device"]["auth_token"],
            self.config["device"]["id"]
        )

        # Setup headers with basic auth token
        self.session.headers.update({
            'Authorization': f'Bearer {self.config["device"]["auth_token"]}',
            'Content-Type': 'application/json',
            'X-Encryption-Version': '1'  # For future encryption protocol updates
        })

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

        # Initialize modem
        self._setup_modem()

    def _load_config(self):
        config = ConfigParser()
        config.read('/etc/call-detector/config.ini')
        return config

    def _handle_shutdown(self, signum, frame):
        logging.info("Received shutdown signal, stopping gracefully...")
        self.running = False
        if self.modem:
            self.modem.close()

    def _setup_modem(self):
        """Initialize and configure the modem"""
        try:
            device = self.config["modem"]["device"]
            baud_rate = int(self.config["modem"].get("baud_rate", "57600"))

            logging.info(f"Initializing modem on {device} at {baud_rate} baud...")
            self.modem = serial.Serial(
                port=device,
                baudrate=baud_rate,
                timeout=1
            )

            # Initialize modem
            init_string = self.config["modem"].get("init_string", "ATZ")
            logging.info(f"Sending init command: {init_string}")
            self.modem.write(f"{init_string}\r".encode())
            time.sleep(1)

            # Try multiple caller ID enable commands
            caller_id_commands = [
                "AT+VCID=1",  # Standard caller ID
                "AT#CID=1",   # Alternative format
                "AT+CLIP=1",  # Calling Line Identification Presentation
            ]
            
            for cmd in caller_id_commands:
                logging.info(f"Sending caller ID command: {cmd}")
                self.modem.write(f"{cmd}\r".encode())
                time.sleep(0.5)
                # Read response
                if self.modem.in_waiting:
                    response = self.modem.read(self.modem.in_waiting).decode(errors='ignore')
                    logging.info(f"Modem response to {cmd}: {response.strip()}")

            logging.info(f"Modem initialized successfully on {device}")
        except Exception as e:
            logging.error(f"Failed to initialize modem: {str(e)}")
            self.modem = None

    def _encrypt_payload(self, data: dict) -> str:
        """Encrypt payload before sending to server"""
        return self.encryption.encrypt(data)

    def _decrypt_response(self, response_text: str) -> dict:
        """Decrypt response from server"""
        try:
            return self.encryption.decrypt(response_text)
        except Exception as e:
            logging.error(f"Failed to decrypt response: {str(e)}")
            return {}

    def send_heartbeat(self):
        try:
            payload = self._encrypt_payload({
                "timestamp": datetime.now().isoformat(),
                "status": "online",
                "modem_status": "connected" if self.modem and self.modem.is_open else "disconnected"
            })

            response = self.session.post(
                f"{self.config['server']['url']}/api/devices/{self.config['device']['id']}/heartbeat",
                json={"data": payload}
            )
            response.raise_for_status()

            result = self._decrypt_response(response.json()["data"])
            logging.debug("Heartbeat sent successfully")
            return True
        except Exception as e:
            logging.error(f"Failed to send heartbeat: {str(e)}")
            return False

    def screen_call(self, phone_number):
        try:
            payload = self._encrypt_payload({
                "phoneNumber": phone_number,
                "timestamp": datetime.now().isoformat()
            })

            response = self.session.post(
                f"{self.config['server']['url']}/api/devices/{self.config['device']['id']}/screen",
                json={"data": payload}
            )
            response.raise_for_status()

            result = self._decrypt_response(response.json()["data"])
            logging.info(f"Call screening result for {phone_number}: {result}")
            return result.get('action') == 'allow'
        except Exception as e:
            logging.error(f"Failed to screen call: {str(e)}")
            return True  # Allow call by default if screening fails

    def _parse_caller_id(self, line):
        """Parse caller ID information from modem output"""
        try:
            # Log all modem output for debugging
            logging.info(f"[MODEM RAW] {line}")
            
            # Support multiple caller ID formats
            # Format 1: NMBR = <number>
            if "NMBR" in line.upper():
                if "=" in line:
                    phone_number = line.split("=")[1].strip()
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 2: CALLER NUMBER: <number>
            if "CALLER" in line.upper() and "NUMBER" in line.upper():
                parts = line.split(":")
                if len(parts) > 1:
                    phone_number = parts[1].strip()
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 3: +CLIP: "<number>",<type>
            if "+CLIP" in line.upper():
                import re
                match = re.search(r'"([^"]+)"', line)
                if match:
                    phone_number = match.group(1)
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 4: Just a number pattern (10 digits)
            if line.strip().isdigit() and len(line.strip()) >= 10:
                phone_number = line.strip()
                logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                return phone_number
            
            return None
        except Exception as e:
            logging.error(f"Error parsing caller ID: {str(e)}")
            return None

    def monitor_calls(self):
        """Monitor for incoming calls using the modem"""
        if not self.modem or not self.modem.is_open:
            logging.error("Modem not available for call monitoring")
            time.sleep(5)  # Wait before retry
            return

        try:
            if self.modem.in_waiting:
                line = self.modem.readline().decode(errors='ignore').strip()

                if line:
                    # Parse caller ID (this will log all modem output)
                    phone_number = self._parse_caller_id(line)

                    if phone_number:
                        logging.info(f"🔔 INCOMING CALL DETECTED from: {phone_number}")
                        allowed = self.screen_call(phone_number)

                        if not allowed:
                            # Send busy signal or disconnect
                            self.modem.write(b"ATH\r")
                            logging.info(f"🚫 BLOCKED call from {phone_number}")
                        else:
                            logging.info(f"✅ ALLOWED call from {phone_number}")

        except Exception as e:
            logging.error(f"Error monitoring calls: {str(e)}")
            self._setup_modem()  # Try to reinitialize modem

    def run(self):
        logging.info("Starting call detector service...")
        last_heartbeat = 0

        while self.running:
            current_time = time.time()

            # Send heartbeat every 30 seconds
            if current_time - last_heartbeat >= 30:
                if self.send_heartbeat():
                    last_heartbeat = current_time

            # Monitor for calls
            self.monitor_calls()

            # Small delay to prevent CPU overuse
            time.sleep(0.1)

if __name__ == "__main__":
    detector = CallDetector()
    detector.run()