import os
import sys
import time
import json
import signal
import logging
import requests
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

        # Initialize encryption with auth token
        self.encryption = DeviceEncryption(self.config["device"]["auth_token"])

        # Setup headers with basic auth token
        self.session.headers.update({
            'Authorization': f'Bearer {self.config["device"]["auth_token"]}',
            'Content-Type': 'application/json',
            'X-Encryption-Version': '1'  # For future encryption protocol updates
        })

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

    def _load_config(self):
        config = ConfigParser()
        config.read('/etc/call-detector/config.ini')
        return config

    def _handle_shutdown(self, signum, frame):
        logging.info("Received shutdown signal, stopping gracefully...")
        self.running = False

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
                "status": "online"
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

    def monitor_calls(self):
        """
        This is a placeholder for the actual call monitoring implementation.
        The actual implementation would depend on the hardware and phone system being used.
        """
        logging.info("Started monitoring for incoming calls...")
        while self.running:
            # Implement actual call detection here
            # This could involve:
            # - Reading from a serial port
            # - Monitoring a GPIO pin
            # - Interfacing with a modem
            # - Processing audio input
            # For now, we'll just sleep
            time.sleep(1)

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

if __name__ == "__main__":
    detector = CallDetector()
    detector.run()