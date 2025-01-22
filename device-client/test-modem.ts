import { ModemInterface } from '../server/services/modemInterface.js';
import { SpamDetectionService } from '../server/services/spamDetectionService.js';
import { CallCachingService } from '../server/services/callCachingService.js';
import chalk from 'chalk';

const log = {
  info: (msg: string) => console.log(chalk.blue('i'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warning: (msg: string) => console.log(chalk.yellow('!'), msg)
};

interface TestCase {
  number: string;
  description: string;
  expectedResult: 'blocked' | 'allowed';
  reason?: string;
}

async function testModem() {
  log.info('Starting modem interface test in development mode...');

  const modem = new ModemInterface({
    deviceId: 'test_device_123',
    port: '/dev/null',
    baudRate: 115200,
    developmentMode: true
  });

  // Track test results
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  // Set up event listeners for modem events
  modem.on('call-blocked', (data) => {
    log.success(`Call blocked: ${JSON.stringify(data, null, 2)}`);
    if (currentTest && currentTest.expectedResult === 'blocked') {
      testsPassed++;
      log.success(`Test passed: ${currentTest.description}`);
    } else if (currentTest) {
      testsFailed++;
      log.error(`Test failed: Expected allowed but got blocked for ${currentTest.description}`);
    }
  });

  modem.on('call-allowed', (data) => {
    log.success(`Call allowed: ${JSON.stringify(data, null, 2)}`);
    if (currentTest && currentTest.expectedResult === 'allowed') {
      testsPassed++;
      log.success(`Test passed: ${currentTest.description}`);
    } else if (currentTest) {
      testsFailed++;
      log.error(`Test failed: Expected blocked but got allowed for ${currentTest.description}`);
    }
  });

  modem.on('call-screening', (data) => {
    log.info(`Call screening: ${JSON.stringify(data, null, 2)}`);
  });

  modem.on('error', (error) => {
    log.error(`Modem error: ${error}`);
    if (currentTest) {
      testsFailed++;
      log.error(`Test failed due to error: ${currentTest.description}`);
    }
  });

  let currentTest: TestCase | null = null;

  try {
    // Wait for spam detection service initialization
    log.info('Initializing spam detection service...');
    await SpamDetectionService.ensureModelInitialized();

    log.info('Initializing modem...');
    const initialized = await modem.initialize();

    if (initialized) {
      log.success('Modem initialized successfully');

      // Get and display current modem status
      const status = await modem.getStatus();
      log.info('Current modem status:');
      console.log(status);

      // Initialize call caching service
      const cacheService = CallCachingService.getInstance();
      await cacheService.initialize();

      log.info('\nRunning test cases...');

      // Define test cases
      const testCases: TestCase[] = [
        { 
          number: '+1234567890',
          description: 'Unknown number with no history',
          expectedResult: 'allowed'
        },
        { 
          number: '+1987654321',
          description: 'Known spam number',
          expectedResult: 'blocked',
          reason: 'spam_detected'
        },
        { 
          number: '+1555000999',
          description: 'Verified safe number',
          expectedResult: 'allowed'
        },
        {
          number: '+1555000000',
          description: 'Number matching spam pattern',
          expectedResult: 'blocked'
        },
        {
          number: '+1234123412',
          description: 'Number requiring voice screening',
          expectedResult: 'allowed'
        }
      ];

      // Run test cases
      for (const test of testCases) {
        testsRun++;
        currentTest = test;
        log.info(`\nTest case ${testsRun}/${testCases.length}: ${test.description}`);
        log.info(`Testing number: ${test.number}`);

        try {
          modem.simulateIncomingCall(test.number);
          // Increased wait time to ensure proper processing
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          testsFailed++;
          log.error(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Print test summary
      log.info('\nTest Summary:');
      console.log('-------------------');
      console.log(`Total tests: ${testsRun}`);
      console.log(`Passed: ${chalk.green(testsPassed)}`);
      console.log(`Failed: ${chalk.red(testsFailed)}`);
      console.log('-------------------');

      if (testsFailed > 0) {
        throw new Error(`${testsFailed} tests failed`);
      }

      log.success('All tests completed successfully');
    } else {
      log.error('Failed to initialize modem');
      process.exit(1);
    }
  } catch (error) {
    log.error(`Error during modem test: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await modem.disconnect();
  }
}

// Run the test
testModem().catch(error => {
  log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

export { testModem };