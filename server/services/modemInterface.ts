import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { db } from "@db";
import { deviceConfigurations } from "@db/schema";
import { eq } from "drizzle-orm";
import { SpamDetectionService } from "./spamDetectionService";
import { CallCachingService } from "./callCachingService";

interface ModemConfig {
  deviceId: string;
  port: string;  // USB port e.g., '/dev/ttyUSB0'
  baudRate: number;
  developmentMode?: boolean;
}

export class ModemInterface extends EventEmitter {
  private port: SerialPort | null;
  private deviceId: string;
  private buffer: string = '';
  private initialized: boolean = false;
  private callInProgress: boolean = false;
  private lastCommand: string = '';
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 3;
  private developmentMode: boolean;
  private spamModelInitialized: boolean = false;

  constructor(config: ModemConfig) {
    super();
    this.deviceId = config.deviceId;
    this.developmentMode = config.developmentMode || false;

    if (!this.developmentMode) {
      this.port = new SerialPort({
        path: config.port,
        baudRate: config.baudRate || 115200,
        autoOpen: false,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        rtscts: true,
        xon: true,
        xoff: true
      });
      this.setupEventListeners();
    } else {
      this.port = null;
      console.log('ModemInterface running in development mode');
    }
  }

  private setupEventListeners(): void {
    if (!this.port || this.developmentMode) return;

    this.port.on('data', (data: Buffer) => this.handleData(data));
    this.port.on('error', (error: Error) => this.handleError(error));
    this.port.on('close', () => {
      console.log('Modem port closed');
      this.initialized = false;
    });
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.developmentMode) {
        console.log('Development mode: Simulating modem initialization');
        this.initialized = true;
        // Initialize spam detection model
        await SpamDetectionService.ensureModelInitialized();
        this.spamModelInitialized = true;
        return true;
      }

      await this.openPort();
      await this.configureModem();
      // Initialize spam detection model
      await SpamDetectionService.ensureModelInitialized();
      this.spamModelInitialized = true;
      this.initialized = true;
      console.log('Modem initialized successfully');
      return true;
    } catch (error) {
      console.error('Modem initialization failed:', error);
      if (!this.developmentMode) {
        await this.attemptRecovery();
      }
      return false;
    }
  }

  private async openPort(): Promise<void> {
    if (this.developmentMode) return;

    return new Promise((resolve, reject) => {
      this.port!.open((err) => {
        if (err) {
          reject(new Error(`Failed to open port: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async configureModem(): Promise<void> {
    // Standard V.92 modem initialization sequence
    // Compatible with USRobotics 5637 and StarTech 56k USB modems
    const initCommands = [
      { cmd: USR_COMMANDS.RESET, delay: 1000 },
      { cmd: USR_COMMANDS.FACTORY_RESET, delay: 1000 },
      { cmd: USR_COMMANDS.CALLER_ID, delay: 500 },
      { cmd: USR_COMMANDS.VOICE_MODE, delay: 500 },
      { cmd: USR_COMMANDS.NO_AUTO_ANSWER, delay: 500 },
      { cmd: USR_COMMANDS.FLOW_CONTROL, delay: 500 },
      { cmd: USR_COMMANDS.SPEAKER_OFF, delay: 500 },
      { cmd: USR_COMMANDS.SAVE_SETTINGS, delay: 1000 }
    ];

    for (const { cmd, delay } of initCommands) {
      try {
        await this.sendCommand(cmd);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`Failed to execute command ${cmd}:`, error);
        throw error;
      }
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (this.developmentMode) {
      console.log(`Development mode: Simulating command: ${command}`);
      return 'OK';
    }

    return new Promise((resolve, reject) => {
      this.lastCommand = command;
      let response = '';
      const timeout = setTimeout(() => {
        this.port?.removeListener('data', handleResponse);
        reject(new Error(`Command timeout: ${command}`));
      }, 5000);

      const handleResponse = (data: Buffer) => {
        response += data.toString();
        if (response.includes('OK') || response.includes('ERROR')) {
          clearTimeout(timeout);
          this.port?.removeListener('data', handleResponse);
          if (response.includes('ERROR')) {
            reject(new Error(`Command failed: ${command} - Response: ${response}`));
          } else {
            resolve(response);
          }
        }
      };

      this.port?.on('data', handleResponse);
      this.port?.write(command + '\r\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.port?.removeListener('data', handleResponse);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  private async handleData(data: Buffer): Promise<void> {
    this.buffer += data.toString();

    if (this.buffer.includes('\r\n')) {
      const messages = this.buffer.split('\r\n');
      this.buffer = messages.pop() || '';

      for (const message of messages) {
        const trimmedMessage = message.trim();
        if (trimmedMessage) {
          await this.parseModemResponse(trimmedMessage);
        }
      }
    }
  }

  private async parseModemResponse(message: string): Promise<void> {
    // USRobotics specific response parsing
    if (message.startsWith('NMBR=')) {
      const phoneNumber = message.split('=')[1].trim();
      await this.handleIncomingCall(phoneNumber);
    }
    else if (message.includes('RING')) {
      this.emit('ring');
    }
    else if (message.includes('NO CARRIER')) {
      this.callInProgress = false;
      this.emit('hangup');
    }
    else if (message.includes('BUSY')) {
      this.emit('busy');
    }
    else if (message.includes('NO DIALTONE')) {
      this.emit('error', new Error('No dial tone detected'));
      await this.attemptRecovery();
    }
  }

  private async handleIncomingCall(phoneNumber: string): Promise<void> {
    try {
      if (!this.spamModelInitialized) {
        console.log('Spam detection model not initialized, using fallback mode');
        // In development mode, allow calls but with warning
        if (this.developmentMode) {
          this.emit('call-allowed', {
            phoneNumber,
            confidence: 0.5,
            features: {
              developmentMode: true,
              warning: 'Spam detection model not initialized'
            }
          });
          return;
        }
      }

      // Initialize cache service
      const cacheService = CallCachingService.getInstance();

      // Check cache first for quick response
      const cachedResult = await cacheService.getCallResult(phoneNumber);

      if (cachedResult) {
        if (cachedResult.isSpam) {
          await this.sendCommand(USR_COMMANDS.HANG_UP);
          this.emit('call-blocked', {
            phoneNumber,
            reason: 'cached_spam',
            confidence: cachedResult.confidence,
            metadata: cachedResult.metadata
          });
          return;
        } else if (cachedResult.confidence > 0.9) {
          this.emit('call-allowed', {
            phoneNumber,
            confidence: cachedResult.confidence,
            metadata: cachedResult.metadata
          });
          this.callInProgress = true;
          return;
        }
      }

      // Call data with basic attributes
      const callData = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        duration: 0,
        metadata: {
          deviceId: this.deviceId,
          callType: 'landline',
          modemType: 'USRobotics_5637',
          developmentMode: this.developmentMode
        }
      };

      try {
        // Get predictive spam score
        const spamPrediction = await SpamDetectionService.predictSpam(phoneNumber, callData);

        // Update cache with new prediction
        await cacheService.updateCallResult(phoneNumber, {
          isSpam: spamPrediction.isSpam,
          confidence: spamPrediction.confidence,
          metadata: spamPrediction.features
        });

        if (spamPrediction.isSpam && spamPrediction.confidence > 0.7) {
          await this.sendCommand(USR_COMMANDS.HANG_UP);
          this.emit('call-blocked', {
            phoneNumber,
            reason: 'spam_detected',
            confidence: spamPrediction.confidence,
            features: spamPrediction.features
          });
        } else if (spamPrediction.confidence < 0.6 || !cachedResult) {
          const screeningResult = await this.screenCall(phoneNumber);
          if (screeningResult === 'blocked') {
            await this.sendCommand(USR_COMMANDS.HANG_UP);
            this.emit('call-blocked', {
              phoneNumber,
              reason: 'failed_screening',
              confidence: spamPrediction.confidence,
              features: ['Failed voice screening']
            });
          } else {
            this.emit('call-allowed', {
              phoneNumber,
              confidence: spamPrediction.confidence,
              features: spamPrediction.features,
              metadata: {
                screeningPassed: true,
                developmentMode: this.developmentMode
              }
            });
            this.callInProgress = true;
          }
        } else {
          this.emit('call-allowed', {
            phoneNumber,
            confidence: spamPrediction.confidence,
            features: spamPrediction.features,
            metadata: { developmentMode: this.developmentMode }
          });
          this.callInProgress = true;
        }
      } catch (predictionError) {
        console.error('Error in spam prediction:', predictionError);
        // Allow call but with warning
        this.emit('call-allowed', {
          phoneNumber,
          confidence: 0.5,
          features: {
            developmentMode: this.developmentMode,
            warning: 'Spam prediction failed',
            error: predictionError instanceof Error ? predictionError.message : 'Unknown error'
          }
        });
        this.callInProgress = true;
      }
    } catch (error) {
      console.error('Error handling incoming call:', error);
      // In development mode, we'll still process the call
      if (this.developmentMode) {
        this.emit('call-allowed', {
          phoneNumber,
          confidence: 0.5,
          features: {
            developmentMode: true,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      } else {
        // In production, default to allowing call in case of error
        this.emit('call-allowed', { phoneNumber, error: true });
      }
    }
  }

  private async screenCall(phoneNumber: string): Promise<'blocked' | 'allowed'> {
    try {
      // Answer call for screening
      await this.sendCommand(USR_COMMANDS.SPEAKER_ON);
      await this.sendCommand(USR_COMMANDS.ANSWER);

      // Emit event for call screening start
      this.emit('call-screening', {
        phoneNumber,
        status: 'screening_started'
      });

      // Wait for 2 seconds before playing message
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In development mode, simulate a successful screening
      if (this.developmentMode) {
        // Emit screening progress event
        this.emit('call-screening', {
          phoneNumber,
          status: 'awaiting_response'
        });

        // Simulate screening decision based on phone number pattern
        const isSpam = phoneNumber.endsWith('0000') || phoneNumber.startsWith('+1555');
        return isSpam ? 'blocked' : 'allowed';
      }

      // TODO: Implement real audio playback for screening message
      // For now, just emit the screening event
      this.emit('call-screening', {
        phoneNumber,
        status: 'awaiting_response'
      });

      // Default to allowing in development
      return 'allowed';

    } catch (error) {
      console.error('Error screening call:', error);
      await this.sendCommand(USR_COMMANDS.HANG_UP);
      this.emit('call-screening', {
        phoneNumber,
        status: 'screening_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 'blocked';
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (this.retryCount >= this.MAX_RETRIES) {
      this.emit('error', new Error('Max retry attempts reached'));
      return;
    }

    this.retryCount++;
    console.log(`Attempting modem recovery (attempt ${this.retryCount})`);

    try {
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.initialize();
      this.retryCount = 0;
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      if (this.retryCount < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.attemptRecovery();
      }
    }
  }

  private handleError(error: Error): void {
    console.error('Modem error:', error);
    this.emit('error', error);
    this.attemptRecovery().catch(console.error);
  }

  async disconnect(): Promise<void> {
    if (this.developmentMode) {
      this.initialized = false;
      return;
    }

    if (this.port?.isOpen) {
      return new Promise((resolve) => {
        this.port!.close(() => {
          this.initialized = false;
          resolve();
        });
      });
    }
  }

  async getStatus(): Promise<{
    initialized: boolean;
    callInProgress: boolean;
    lastCommand: string;
    retryCount: number;
    portOpen: boolean;
    developmentMode: boolean;
  }> {
    return {
      initialized: this.initialized,
      callInProgress: this.callInProgress,
      lastCommand: this.lastCommand,
      retryCount: this.retryCount,
      portOpen: this.developmentMode ? false : (this.port?.isOpen || false),
      developmentMode: this.developmentMode
    };
  }

  // Development mode test methods
  simulateIncomingCall(phoneNumber: string): void {
    if (!this.developmentMode) {
      console.warn('simulateIncomingCall can only be used in development mode');
      return;
    }

    this.handleIncomingCall(phoneNumber).catch(error => {
      console.error('Error handling simulated call:', error);
    });
  }
}

// USRobotics specific AT commands
const USR_COMMANDS = {
  RESET: 'ATZ',
  FACTORY_RESET: 'AT&F',
  CALLER_ID: 'AT+VCID=1',
  VOICE_MODE: 'AT+FCLASS=0',
  NO_AUTO_ANSWER: 'ATS0=0',
  FLOW_CONTROL: 'AT&K3',
  SAVE_SETTINGS: 'AT&W',
  SPEAKER_ON: 'ATM1',
  SPEAKER_OFF: 'ATM0',
  HANG_UP: 'ATH',
  ANSWER: 'ATA'
};

async function testModem() {
  const modem = new ModemInterface({
    deviceId: 'device_123',
    port: '/dev/ttyUSB0',
    baudRate: 115200,
    developmentMode: true // Set to true for development testing
  });

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


  const initialized = await modem.initialize();
  if (initialized) {
    const status = await modem.getStatus();
    console.log('Modem Status:', status);
    if (!status.developmentMode) {
      await modem.disconnect();
    }
    //Simulate a call in development mode
    if(status.developmentMode){
      modem.simulateIncomingCall('1234567890');
    }
  }
}

testModem();