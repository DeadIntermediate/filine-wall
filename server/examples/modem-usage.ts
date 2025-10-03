import { ModemInterface } from '../services/modemInterface';

// Example usage of the ModemInterface
// Works with USRobotics 5637, StarTech 56k USB V.92, and compatible modems
async function main() {
  const modem = new ModemInterface({
    deviceId: 'v92_modem_001',
    port: '/dev/ttyUSB0', // Typical USB modem port (or use /dev/ttyUSB-modem symlink)
    baudRate: 115200
  });

  // Set up event listeners
  modem.on('call-blocked', (data) => {
    console.log('Call blocked:', data);
  });

  modem.on('call-allowed', (data) => {
    console.log('Call allowed:', data);
  });

  modem.on('call-screening', (data) => {
    console.log('Call screening:', data);
  });

  modem.on('error', (error) => {
    console.error('Modem error:', error);
  });

  // Initialize the modem
  try {
    const initialized = await modem.initialize();
    if (initialized) {
      console.log('Modem initialized successfully');
      console.log('Waiting for calls...');

      // Example: Get modem status after 5 seconds
      setTimeout(async () => {
        const status = await modem.getStatus();
        console.log('Modem status:', status);
      }, 5000);
    }
  } catch (error) {
    console.error('Failed to initialize modem:', error);
  }
}

// Only run if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}
