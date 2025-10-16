import os
import json
import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

class DeviceEncryption:
    def __init__(self, auth_token: str, device_id: str = None):
        """Initialize encryption using device auth token as key material"""
        # Generate a unique salt per device or use device_id based salt
        if device_id:
            # Use device_id to create a consistent but unique salt per device
            self.salt = base64.urlsafe_b64decode(
                base64.urlsafe_b64encode(f"filine_salt_{device_id}".ljust(16)[:16].encode())
            )
        else:
            # Fallback to a generated salt (should be stored securely in production)
            self.salt = secrets.token_bytes(16)
        
        # Use PBKDF2 to derive a secure key from the auth token
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(auth_token.encode()))
        self.fernet = Fernet(key)

    def encrypt(self, data: dict) -> str:
        """Encrypt data before sending to server"""
        try:
            json_str = json.dumps(data)
            encrypted = self.fernet.encrypt(json_str.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            raise ValueError(f"Encryption failed: {str(e)}")

    def decrypt(self, encrypted_data: str) -> dict:
        """Decrypt data received from server"""
        try:
            decoded = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self.fernet.decrypt(decoded)
            return json.loads(decrypted.decode())  # Safe JSON parsing instead of eval()
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in decrypted data: {str(e)}")
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")
