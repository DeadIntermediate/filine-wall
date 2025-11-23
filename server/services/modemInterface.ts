import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { db } from "@db";
import { deviceConfigurations } from "@db/schema";
import { eq } from "drizzle-orm";
import { SpamDetectionService } from "./spamDetectionService";
import { CallCachingService } from "./callCachingService";
import { 
  type ModemProfile, 
  getModemProfile, 
  detectModemModel,
  AT_COMMANDS 
} from "../config/modemProfiles";

interface ModemConfig {
  deviceId: string;
  port: string;  // USB port e.g., '/dev/ttyUSB0'
  baudRate?: number;  // Optional, will use profile default
  developmentMode?: boolean;
  modemModel?: string;  // Optional: 'USR5637', 'STARTECH_V92', 'GRANDSTREAM_HT802', 'GENERIC_V92'
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
  private modemProfile: ModemProfile;
  private detectedModel: string = 'GENERIC_V92';

  constructor(config: ModemConfig) {
    super();
    this.deviceId = config.deviceId;
    this.developmentMode = config.developmentMode || false;
    
    // Get modem profile
    const modelId = config.modemModel || 'GENERIC_V92';
    this.modemProfile = getModemProfile(modelId);
    this.detectedModel = modelId;

    if (!this.developmentMode) {
      this.port = new SerialPort({
        path: config.port,
        baudRate: config.baudRate || this.modemProfile.baudRate,
        dataBits: this.modemProfile.dataBits,
        stopBits: this.modemProfile.stopBits,
        parity: this.modemProfile.parity,
        rtscts: this.modemProfile.flowControl.rtscts,
        xon: this.modemProfile.flowControl.xon,
        xoff: this.modemProfile.flowControl.xoff,
        autoOpen: false,
      });
      this.setupEventListeners();
    } else {
      this.port = null;
      console.log(`ModemInterface running in development mode (Profile: ${this.modemProfile.name})`);
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
        console.log(`Development mode: Simulating modem initialization (${this.modemProfile.name})`);
        this.initialized = true;
        // Initialize spam detection model
        await SpamDetectionService.ensureModelInitialized();
        this.spamModelInitialized = true;
        return true;
      }

      await this.openPort();
      
      // Try to detect modem model if not specified
      if (this.detectedModel === 'GENERIC_V92') {
        try {
          const detectedModelId = await detectModemModel(this.sendCommand.bind(this));
          if (detectedModelId !== 'GENERIC_V92') {
            this.detectedModel = detectedModelId;
            this.modemProfile = getModemProfile(detectedModelId);
            console.log(`Detected modem model: ${this.modemProfile.name}`);
          }
        } catch (error) {
          console.log('Could not auto-detect modem model, using configured profile');
        }
      }
      
      await this.configureModem();
      // Initialize spam detection model
      await SpamDetectionService.ensureModelInitialized();
      this.spamModelInitialized = true;
      this.initialized = true;
      console.log(`Modem initialized successfully: ${this.modemProfile.name}`);
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
      this.port!.open((err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open port: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async configureModem(): Promise<void> {
    console.log(`Configuring modem with profile: ${this.modemProfile.name}`);
    
    // Use modem profile's initialization sequence
    const initCommands = this.modemProfile.initSequence;

    for (const { cmd, description, delay, optional } of initCommands) {
      try {
        console.log(`Executing: ${description} (${cmd})`);
        await this.sendCommand(cmd);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        if (optional) {
          console.warn(`Optional command failed: ${cmd} - ${description}`);
          continue;
        }
        console.error(`Failed to execute command ${cmd}:`, error);
        throw error;
      }
    }
    
    console.log('Modem configuration completed successfully');
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
      this.port?.write(command + '\r\n', (err: Error | null | undefined) => {
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
    const patterns = this.modemProfile.responsePatterns;
    
    // Check for caller ID using modem-specific pattern
    if (message.startsWith(patterns.callerIdPrefix)) {
      const phoneNumber = message.split('=')[1]?.trim();
      if (phoneNumber) {
        await this.handleIncomingCall(phoneNumber);
      }
    }
    // Check for caller name if supported
    else if (patterns.callerNamePrefix && message.startsWith(patterns.callerNamePrefix)) {
      const callerName = message.split('=')[1]?.trim();
      this.emit('caller-name', callerName);
    }
    // Check for ring
    else if (message.includes(patterns.ringPattern)) {
      this.emit('ring');
    }
    // Check for hangup/disconnect
    else if (message.includes(patterns.hangupPattern)) {
      this.callInProgress = false;
      this.emit('hangup');
    }
    // Check for busy
    else if (message.includes(patterns.busyPattern)) {
      this.emit('busy');
    }
    // Check for no dial tone
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
          await this.sendCommand(AT_COMMANDS.HANG_UP);
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
          modemType: this.detectedModel,
          modemName: this.modemProfile.name,
          modemManufacturer: this.modemProfile.manufacturer,
          developmentMode: this.developmentMode,
          callerIdSupport: this.modemProfile.features.callerIdSupport,
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
          await this.sendCommand(AT_COMMANDS.HANG_UP);
          this.emit('call-blocked', {
            phoneNumber,
            reason: 'spam_detected',
            confidence: spamPrediction.confidence,
            features: spamPrediction.features
          });
        } else if (spamPrediction.confidence < 0.6 || !cachedResult) {
          const screeningResult = await this.screenCall(phoneNumber);
          if (screeningResult === 'blocked') {
            await this.sendCommand(AT_COMMANDS.HANG_UP);
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
      await this.sendCommand(AT_COMMANDS.SPEAKER_ON);
      await this.sendCommand(AT_COMMANDS.ANSWER);

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
      await this.sendCommand(AT_COMMANDS.HANG_UP);
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
    modemProfile: {
      name: string;
      manufacturer: string;
      model: string;
      callerIdSupport: boolean;
    };
  }> {
    return {
      initialized: this.initialized,
      callInProgress: this.callInProgress,
      lastCommand: this.lastCommand,
      retryCount: this.retryCount,
      portOpen: this.developmentMode ? false : (this.port?.isOpen || false),
      developmentMode: this.developmentMode,
      modemProfile: {
        name: this.modemProfile.name,
        manufacturer: this.modemProfile.manufacturer,
        model: this.detectedModel,
        callerIdSupport: this.modemProfile.features.callerIdSupport,
      }
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

// Test function for development
async function testModem() {
  const modem = new ModemInterface({
    deviceId: 'device_123',
    port: '/dev/ttyUSB0',
    developmentMode: true, // Set to true for development testing
    modemModel: 'USR5637'  // Specify USRobotics USR5637 model
  });

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

  modem.on('caller-name', (name: string) => {
    console.log('Caller name:', name);
  });

  const initialized = await modem.initialize();
  if (initialized) {
    const status = await modem.getStatus();
    console.log('Modem Status:', status);
    console.log(`\nModem Profile: ${status.modemProfile.name}`);
    console.log(`Manufacturer: ${status.modemProfile.manufacturer}`);
    console.log(`Caller ID Support: ${status.modemProfile.callerIdSupport ? 'Yes' : 'No'}`);
    
    if (!status.developmentMode) {
      await modem.disconnect();
    }
    
    // Simulate incoming calls in development mode
    if (status.developmentMode) {
      console.log('\n--- Testing Call Scenarios ---');
      
      console.log('\n1. Testing legitimate call:');
      await modem.simulateIncomingCall('+14155551234');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('\n2. Testing spam pattern (ends with 0000):');
      await modem.simulateIncomingCall('+15551230000');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('\n3. Testing another spam pattern (starts with +1555):');
      await modem.simulateIncomingCall('+15551234567');
    }
  }
}

// Uncomment to run test
// testModem().catch(console.error);

testModem();