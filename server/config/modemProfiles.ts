/**
 * Modem Configuration and AT Commands
 * Support for multiple USB modem models with specific configurations
 */

export interface ModemProfile {
  name: string;
  manufacturer: string;
  model: string;
  baudRate: number;
  dataBits: 8 | 7 | 6 | 5;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  flowControl: {
    rtscts: boolean;
    xon: boolean;
    xoff: boolean;
  };
  initSequence: ModemCommand[];
  features: {
    callerIdSupport: boolean;
    voiceMode: boolean;
    dtmfDetection: boolean;
    callWaiting: boolean;
    distinctiveRing: boolean;
  };
  responsePatterns: {
    callerIdPrefix: string;
    callerNamePrefix?: string;
    ringPattern: string;
    hangupPattern: string;
    busyPattern: string;
  };
}

export interface ModemCommand {
  cmd: string;
  description: string;
  delay: number; // milliseconds
  optional?: boolean;
}

/**
 * USRobotics USR5637 USB Fax Modem
 * Industry-standard V.92 modem with excellent Caller ID support
 */
export const USR5637_PROFILE: ModemProfile = {
  name: 'USRobotics USR5637',
  manufacturer: 'USRobotics',
  model: 'USR5637',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: {
    rtscts: true,
    xon: true,
    xoff: true,
  },
  initSequence: [
    { cmd: 'ATZ', description: 'Reset modem to default state', delay: 1000 },
    { cmd: 'AT&F', description: 'Load factory defaults', delay: 1000 },
    { cmd: 'ATE0', description: 'Disable command echo', delay: 300 },
    { cmd: 'ATQ0', description: 'Enable result codes', delay: 300 },
    { cmd: 'ATV1', description: 'Verbose result codes', delay: 300 },
    { cmd: 'AT+VCID=1', description: 'Enable Caller ID detection', delay: 500 },
    { cmd: 'AT#CID=1', description: 'Enable formatted Caller ID', delay: 500 },
    { cmd: 'AT+FCLASS=0', description: 'Set to data mode (not fax)', delay: 500 },
    { cmd: 'ATS0=0', description: 'Disable auto-answer', delay: 300 },
    { cmd: 'AT&K3', description: 'Enable RTS/CTS flow control', delay: 300 },
    { cmd: 'ATX4', description: 'Enable all call progress detection', delay: 300 },
    { cmd: 'ATM0', description: 'Speaker off', delay: 300 },
    { cmd: 'AT&W', description: 'Save settings to NVRAM', delay: 1000 },
  ],
  features: {
    callerIdSupport: true,
    voiceMode: true,
    dtmfDetection: true,
    callWaiting: true,
    distinctiveRing: true,
  },
  responsePatterns: {
    callerIdPrefix: 'NMBR=',
    callerNamePrefix: 'NAME=',
    ringPattern: 'RING',
    hangupPattern: 'NO CARRIER',
    busyPattern: 'BUSY',
  },
};

/**
 * StarTech 56k USB V.92 Fax Modem
 * Compatible alternative with similar capabilities
 */
export const STARTECH_V92_PROFILE: ModemProfile = {
  name: 'StarTech 56k USB V.92',
  manufacturer: 'StarTech',
  model: 'USB56KEMH2',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: {
    rtscts: true,
    xon: true,
    xoff: true,
  },
  initSequence: [
    { cmd: 'ATZ', description: 'Reset modem', delay: 1000 },
    { cmd: 'AT&F', description: 'Factory defaults', delay: 1000 },
    { cmd: 'ATE0', description: 'Echo off', delay: 300 },
    { cmd: 'ATQ0', description: 'Result codes on', delay: 300 },
    { cmd: 'ATV1', description: 'Verbose mode', delay: 300 },
    { cmd: 'AT+VCID=1', description: 'Caller ID on', delay: 500 },
    { cmd: 'AT+FCLASS=0', description: 'Data mode', delay: 500 },
    { cmd: 'ATS0=0', description: 'No auto-answer', delay: 300 },
    { cmd: 'AT&K3', description: 'Hardware flow control', delay: 300 },
    { cmd: 'ATX4', description: 'Extended result codes', delay: 300 },
    { cmd: 'ATM0', description: 'Speaker mute', delay: 300 },
    { cmd: 'AT&W', description: 'Save configuration', delay: 1000 },
  ],
  features: {
    callerIdSupport: true,
    voiceMode: true,
    dtmfDetection: true,
    callWaiting: true,
    distinctiveRing: false,
  },
  responsePatterns: {
    callerIdPrefix: 'NMBR=',
    callerNamePrefix: 'NAME=',
    ringPattern: 'RING',
    hangupPattern: 'NO CARRIER',
    busyPattern: 'BUSY',
  },
};

/**
 * Generic V.92 Modem Profile
 * Fallback for other V.92 compatible modems
 */
export const GENERIC_V92_PROFILE: ModemProfile = {
  name: 'Generic V.92 Modem',
  manufacturer: 'Generic',
  model: 'V92',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: {
    rtscts: true,
    xon: false,
    xoff: false,
  },
  initSequence: [
    { cmd: 'ATZ', description: 'Reset', delay: 1000 },
    { cmd: 'AT&F', description: 'Factory reset', delay: 1000 },
    { cmd: 'ATE0', description: 'Echo off', delay: 300 },
    { cmd: 'ATV1', description: 'Verbose on', delay: 300 },
    { cmd: 'AT+VCID=1', description: 'Caller ID on', delay: 500, optional: true },
    { cmd: 'ATS0=0', description: 'Manual answer', delay: 300 },
    { cmd: 'AT&K3', description: 'Flow control', delay: 300 },
    { cmd: 'ATM0', description: 'Speaker off', delay: 300 },
    { cmd: 'AT&W', description: 'Save', delay: 1000 },
  ],
  features: {
    callerIdSupport: true,
    voiceMode: false,
    dtmfDetection: false,
    callWaiting: false,
    distinctiveRing: false,
  },
  responsePatterns: {
    callerIdPrefix: 'NMBR=',
    ringPattern: 'RING',
    hangupPattern: 'NO CARRIER',
    busyPattern: 'BUSY',
  },
};

/**
 * Modem profiles registry
 */
export const MODEM_PROFILES: Record<string, ModemProfile> = {
  USR5637: USR5637_PROFILE,
  STARTECH_V92: STARTECH_V92_PROFILE,
  GENERIC_V92: GENERIC_V92_PROFILE,
};

/**
 * AT Command reference for all supported modems
 */
export const AT_COMMANDS = {
  // Basic commands
  RESET: 'ATZ',
  FACTORY_RESET: 'AT&F',
  ECHO_OFF: 'ATE0',
  ECHO_ON: 'ATE1',
  RESULT_CODES_ON: 'ATQ0',
  RESULT_CODES_OFF: 'ATQ1',
  VERBOSE_ON: 'ATV1',
  VERBOSE_OFF: 'ATV0',

  // Caller ID commands
  CALLER_ID_ON: 'AT+VCID=1',
  CALLER_ID_OFF: 'AT+VCID=0',
  FORMATTED_CID: 'AT#CID=1',

  // Mode selection
  DATA_MODE: 'AT+FCLASS=0',
  FAX_MODE: 'AT+FCLASS=1',
  VOICE_MODE: 'AT+FCLASS=8',

  // Answer/Hangup
  ANSWER: 'ATA',
  HANG_UP: 'ATH',
  HANG_UP_ALT: 'ATH0',

  // Auto-answer configuration
  NO_AUTO_ANSWER: 'ATS0=0',
  AUTO_ANSWER_1_RING: 'ATS0=1',
  AUTO_ANSWER_2_RINGS: 'ATS0=2',

  // Flow control
  NO_FLOW_CONTROL: 'AT&K0',
  SOFTWARE_FLOW_CONTROL: 'AT&K4',
  HARDWARE_FLOW_CONTROL: 'AT&K3',

  // Call progress
  BASIC_PROGRESS: 'ATX0',
  EXTENDED_PROGRESS: 'ATX4',

  // Speaker control
  SPEAKER_OFF: 'ATM0',
  SPEAKER_ON: 'ATM1',
  SPEAKER_ON_UNTIL_CARRIER: 'ATM2',

  // Volume control
  VOLUME_LOW: 'ATL1',
  VOLUME_MEDIUM: 'ATL2',
  VOLUME_HIGH: 'ATL3',

  // Save/Load settings
  SAVE_SETTINGS: 'AT&W',
  LOAD_PROFILE_0: 'ATZ0',
  LOAD_PROFILE_1: 'ATZ1',

  // Information queries
  GET_MODEL: 'ATI3',
  GET_FIRMWARE: 'ATI7',
  GET_MANUFACTURER: 'AT+FMFR?',
  GET_PRODUCT_CODE: 'AT+FMDL?',

  // USRobotics specific
  USR_GET_CONFIG: 'ATI4',
  USR_GET_SETTINGS: 'ATI6',
  USR_DISTINCTIVE_RING: 'AT-SDR=',

  // Call waiting
  ENABLE_CALL_WAITING: 'AT+CW=1',
  DISABLE_CALL_WAITING: 'AT+CW=0',
};

/**
 * Helper function to detect modem model
 */
export async function detectModemModel(sendCommand: (cmd: string) => Promise<string>): Promise<string> {
  try {
    // Try to get manufacturer
    const manufacturer = await sendCommand(AT_COMMANDS.GET_MANUFACTURER);
    
    // Try to get model
    const model = await sendCommand(AT_COMMANDS.GET_PRODUCT_CODE);

    if (manufacturer.includes('USR') || manufacturer.includes('USRobotics')) {
      if (model.includes('5637')) {
        return 'USR5637';
      }
    }

    if (manufacturer.includes('StarTech')) {
      return 'STARTECH_V92';
    }

    // Default to generic V.92 profile
    return 'GENERIC_V92';
  } catch (error) {
    console.warn('Failed to detect modem model, using generic profile:', error);
    return 'GENERIC_V92';
  }
}

/**
 * Get modem profile by model identifier
 */
export function getModemProfile(modelId: string): ModemProfile {
  const profile = MODEM_PROFILES[modelId];
  if (!profile) {
    console.warn(`Modem profile '${modelId}' not found, using generic V.92 profile`);
    return GENERIC_V92_PROFILE;
  }
  return profile;
}

export default {
  MODEM_PROFILES,
  AT_COMMANDS,
  USR5637_PROFILE,
  STARTECH_V92_PROFILE,
  GENERIC_V92_PROFILE,
  detectModemModel,
  getModemProfile,
};
