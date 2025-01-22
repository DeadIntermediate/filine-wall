import { ModemInterface } from '../server/services/modemInterface';
import { fileURLToPath } from 'url';

async function testModem() {
  console.log('Starting modem interface test in development mode...');

  const modem = new ModemInterface({
    deviceId: 'test_device_123',
    port: '/dev/null',
    baudRate: 115200,
    developmentMode: true
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

      console.log('\nTesting call screening functionality...');

      // Test cases
      const testCases = [
        { number: '+1234567890', description: 'Unknown number' },
        { number: '+1987654321', description: 'Known spam number' },
        { number: '+1555000999', description: 'Verified safe number' }
      ];

      for (const test of testCases) {
        console.log(`\nTesting ${test.description}: ${test.number}`);
        modem.simulateIncomingCall(test.number);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
      }

      console.log('\nTests completed successfully');
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

// Check if this file is being run directly using ESM
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testModem().catch(error => {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  });
}