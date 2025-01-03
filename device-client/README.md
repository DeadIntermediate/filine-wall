# Call Detector Client

This client runs on Linux devices (like Raspberry Pi) to detect incoming calls and communicate with the central web interface for spam detection.

## Installation

1. First, register your device in the web interface and get your device ID and authentication token.

2. Download the installation files to your device:
   ```bash
   git clone [repository-url]
   cd device-client
   ```

3. Run the setup script as root:
   ```bash
   sudo ./setup.sh
   ```

4. Edit the configuration file with your device credentials:
   ```bash
   sudo nano /etc/call-detector/config.ini
   ```
   Update the following values:
   - `url`: Your web interface URL
   - `id`: Your device ID from the web interface
   - `auth_token`: Your device authentication token

5. Restart the service:
   ```bash
   sudo systemctl restart call-detector
   ```

## Monitoring

- Check service status:
  ```bash
  sudo systemctl status call-detector
  ```

- View logs:
  ```bash
  sudo journalctl -u call-detector -f
  ```

## Hardware Setup

This is a base implementation that needs to be extended based on your specific hardware setup. The `monitor_calls()` method in `call_detector.py` should be modified to interface with your actual call detection hardware:

- Serial modem
- GPIO-based detector
- Audio interface
- VoIP system

## Features

- Automatic startup on boot
- Secure communication with web interface
- Regular heartbeat to show online status
- Graceful shutdown handling
- Logging to both file and system journal
- Automatic reconnection on network issues

## Security

- Runs as a dedicated system user with minimal privileges
- Configuration file permissions are restricted
- Uses token-based authentication with the server
- All communication is done via HTTPS (when configured)
