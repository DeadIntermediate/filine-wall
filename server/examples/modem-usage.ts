import { ModemInterface } from '../services/modemInterface';

// Example usage of the ModemInterface
// Works with USRobotics 5637, Grandstream HT802, StarTech 56k USB V.92, and compatible modems
async function main() {
  const modem = new ModemInterface({
    deviceId: 'v92_modem_001',
    port: '/dev/ttyUSB0', // Typical USB modem port (or use /dev/ttyUSB-modem symlink)
    baudRate: 115200,
    // Optional: Specify modem model for optimized configuration
    // modemModel: 'GRANDSTREAM_HT802' // or 'USR5637', 'STARTECH_V92', 'GENERIC_V92'
  });

  // Set up event listeners
  modem.on('call-blocked', (data: any) => {
    console.log('Call blocked:', data);
  });

  modem.on('call-allowed', (data: any) => {
    console.log('Call allowed:', data);
  });

  modem.on('call-screening', (data: any) => {
    console.log('Call screening:', data);
  });

  modem.on('error', (error: Error) => {
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

// Export for use in other modules
export { main };

// Automatically run if needed - uncomment the line below:
// main().catch(console.error);