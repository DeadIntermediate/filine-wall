import { ModemInterface } from '../server/services/modemInterface';

async function testModem() {
  console.log('Starting USRobotics 5637 modem test...');

  const modem = new ModemInterface({
    deviceId: 'usrobotics_5637',
    port: '/dev/ttyUSB-modem', // Using symlink created by udev rules
    baudRate: 115200
  });

  // Set up event listeners for modem events
  modem.on('call-blocked', (data) => {
    console.log('✓ Call blocked:', data);
  });

  modem.on('call-allowed', (data) => {
    console.log('✓ Call allowed:', data);
  });

  modem.on('call-screening', (data) => {
    console.log('i Call screening:', data);
  });

  modem.on('error', (error) => {
    console.error('✗ Modem error:', error);
  });

  try {
    console.log('Initializing modem...');
    const initialized = await modem.initialize();

    if (initialized) {
      console.log('✓ Modem initialized successfully');

      // Get and display current modem status
      const status = await modem.getStatus();
      console.log('Current modem status:', status);

      console.log('\nWaiting for incoming calls (press Ctrl+C to exit)...');
      console.log('NOTE: The modem should be connected to your phone line');

      // Keep the process running to receive calls
      await new Promise(() => {});
    } else {
      console.error('✗ Failed to initialize modem');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error during modem test:', error);
    process.exit(1);
  } finally {
    await modem.disconnect();
  }
}

// Only run if this file is being run directly
if (require.main === module) {
  testModem().catch(error => {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  });
}