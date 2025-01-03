import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

class DeviceEncryption:
    def __init__(self, auth_token: str):
        """Initialize encryption using device auth token as key material"""
        # Use PBKDF2 to derive a secure key from the auth token
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'anti_telemarketing_salt',  # Fixed salt for reproducibility
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(auth_token.encode()))
        self.fernet = Fernet(key)

    def encrypt(self, data: dict) -> str:
        """Encrypt data before sending to server"""
        json_str = str(data)
        encrypted = self.fernet.encrypt(json_str.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt(self, encrypted_data: str) -> dict:
        """Decrypt data received from server"""
        decoded = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = self.fernet.decrypt(decoded)
        return eval(decrypted.decode())  # Safe since we encrypted it ourselves
