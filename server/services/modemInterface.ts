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

export class ModemInterface extends EventEmitter {
  private port: SerialPort;
  private deviceId: string;
  private buffer: string = '';
  private initialized: boolean = false;
  private callInProgress: boolean = false;
  private lastCommand: string = '';
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(config: ModemConfig) {
    super();
    this.deviceId = config.deviceId;
    this.port = new SerialPort({
      path: config.port,
      baudRate: config.baudRate || 115200,
      autoOpen: false,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      rtscts: true, // Hardware flow control for USRobotics
      xon: true,    // Software flow control
      xoff: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.port.on('data', (data: Buffer) => this.handleData(data));
    this.port.on('error', (error: Error) => this.handleError(error));
    this.port.on('close', () => {
      console.log('Modem port closed');
      this.initialized = false;
    });
  }

  async initialize(): Promise<boolean> {
    try {
      await this.openPort();
      await this.configureModem();
      this.initialized = true;
      console.log('Modem initialized successfully');
      return true;
    } catch (error) {
      console.error('Modem initialization failed:', error);
      await this.attemptRecovery();
      return false;
    }
  }

  private async openPort(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(new Error(`Failed to open port: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async configureModem(): Promise<void> {
    // USRobotics specific initialization sequence
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
    return new Promise((resolve, reject) => {
      this.lastCommand = command;
      let response = '';
      const timeout = setTimeout(() => {
        this.port.removeListener('data', handleResponse);
        reject(new Error(`Command timeout: ${command}`));
      }, 5000);

      const handleResponse = (data: Buffer) => {
        response += data.toString();
        if (response.includes('OK') || response.includes('ERROR')) {
          clearTimeout(timeout);
          this.port.removeListener('data', handleResponse);
          if (response.includes('ERROR')) {
            reject(new Error(`Command failed: ${command} - Response: ${response}`));
          } else {
            resolve(response);
          }
        }
      };

      this.port.on('data', handleResponse);
      this.port.write(command + '\r\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.port.removeListener('data', handleResponse);
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
      // Check if device is registered and active
      const device = await db.query.deviceConfigurations.findFirst({
        where: eq(deviceConfigurations.deviceId, this.deviceId),
      });

      if (!device || device.status !== 'online') {
        console.error('Device not registered or inactive');
        await this.sendCommand(USR_COMMANDS.HANG_UP);
        return;
      }

      // Check cache first for quick response
      const cacheService = CallCachingService.getInstance();
      const cachedResult = await cacheService.getCallResult(phoneNumber);

      if (cachedResult) {
        if (cachedResult.isSpam) {
          // Reject call based on cached result
          await this.sendCommand(USR_COMMANDS.HANG_UP);
          this.emit('call-blocked', {
            phoneNumber,
            reason: 'cached_spam',
            confidence: cachedResult.confidence,
            metadata: cachedResult.metadata
          });
          return;
        } else if (cachedResult.confidence > 0.7) {
          // Allow known good numbers immediately
          this.emit('call-allowed', {
            phoneNumber,
            confidence: cachedResult.confidence,
            metadata: cachedResult.metadata
          });
          this.callInProgress = true;
          return;
        }
      }

      // If not in cache or uncertain, perform full analysis
      const callData = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        duration: 0,
        metadata: {
          deviceId: this.deviceId,
          callType: 'landline',
          modemType: 'USRobotics_5637'
        }
      };

      const spamPrediction = await SpamDetectionService.predictSpam(phoneNumber, callData);

      // Update cache with new prediction
      await cacheService.updateCallResult(phoneNumber, {
        isSpam: spamPrediction.isSpam,
        confidence: spamPrediction.confidence,
        metadata: spamPrediction.features
      });

      if (spamPrediction.isSpam) {
        // Reject call
        await this.sendCommand(USR_COMMANDS.HANG_UP);
        this.emit('call-blocked', {
          phoneNumber,
          reason: 'spam_detected',
          confidence: spamPrediction.confidence,
          features: spamPrediction.features
        });
      } else if (spamPrediction.confidence < 0.3) {
        // Screen call
        await this.screenCall(phoneNumber);
      } else {
        // Allow call to ring through
        this.emit('call-allowed', {
          phoneNumber,
          confidence: spamPrediction.confidence,
          features: spamPrediction.features
        });
        this.callInProgress = true;
      }

    } catch (error) {
      console.error('Error handling incoming call:', error);
      // Default to allowing call in case of error
      this.emit('call-allowed', { phoneNumber, error: true });
    }
  }

  private async screenCall(phoneNumber: string): Promise<void> {
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

      // TODO: Implement audio playback for screening message
      // This will require additional hardware setup

      // For now, we'll just emit the screening event
      this.emit('call-screening', {
        phoneNumber,
        status: 'awaiting_response'
      });

    } catch (error) {
      console.error('Error screening call:', error);
      await this.sendCommand(USR_COMMANDS.HANG_UP);
      this.emit('call-screening', {
        phoneNumber,
        status: 'screening_failed',
        error: error.message
      });
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
    if (this.port.isOpen) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.initialized = false;
          resolve();
        });
      });
    }
  }

  // Public method to check modem status
  async getStatus(): Promise<{
    initialized: boolean;
    callInProgress: boolean;
    lastCommand: string;
    retryCount: number;
    portOpen: boolean;
  }> {
    return {
      initialized: this.initialized,
      callInProgress: this.callInProgress,
      lastCommand: this.lastCommand,
      retryCount: this.retryCount,
      portOpen: this.port.isOpen
    };
  }
}

// Example usage:
async function testModem() {
  const modem = new ModemInterface({
    deviceId: 'device_123',
    port: '/dev/ttyUSB0',
    baudRate: 115200
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
  if(initialized){
    const status = await modem.getStatus();
    console.log('Modem Status:', status);
    await modem.disconnect();
  }
}


testModem();