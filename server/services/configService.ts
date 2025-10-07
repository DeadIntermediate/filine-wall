import fs from "fs";
import yaml from "js-yaml";
import path from "path";

interface FiLineWallConfig {
  modem: {
    device: string;
    baudRate: number;
    callerIdEnabled: boolean;
  };
  callScreening: {
    minCallDuration: number;
    autoBlockThreshold: {
      callsPerDay: number;
      repeatWithinMinutes: number;
    };
    ivrEnabled: boolean;
    voicemailEnabled: boolean;
  };
  notifications: {
    discord?: {
      enabled: boolean;
      webhookUrl?: string;
    };
    telegram?: {
      enabled: boolean;
      botToken?: string;
      chatId?: string;
    };
  };
  externalSources: {
    enabled: boolean;
    sources: string[];
  };
  logging: {
    logPath: string;
    dbPath: string;
    voicemailPath: string;
  };
}

const DEFAULT_CONFIG: FiLineWallConfig = {
  modem: {
    device: "/dev/ttyUSB0",
    baudRate: 9600,
    callerIdEnabled: true
  },
  callScreening: {
    minCallDuration: 5,
    autoBlockThreshold: {
      callsPerDay: 3,
      repeatWithinMinutes: 15
    },
    ivrEnabled: true,
    voicemailEnabled: false
  },
  notifications: {
    discord: {
      enabled: false
    },
    telegram: {
      enabled: false
    }
  },
  externalSources: {
    enabled: true,
    sources: ["hiya", "nomorobo", "tellows"]
  },
  logging: {
    logPath: "/var/log/filinewall/",
    dbPath: "/opt/filinewall/filinewall.db",
    voicemailPath: "/opt/filinewall/voicemails/"
  }
};

export class ConfigService {
  private config: FiLineWallConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.CONFIG_PATH || "./config/filinewall.yml";
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from YAML file or use environment variables as fallback
   */
  private loadConfig(): FiLineWallConfig {
    // Try to load from YAML file
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContents = fs.readFileSync(this.configPath, "utf8");
        const yamlConfig = yaml.load(fileContents) as Partial<FiLineWallConfig>;
        console.log(`Loaded configuration from ${this.configPath}`);
        return this.mergeWithDefaults(yamlConfig);
      } catch (error) {
        console.error("Error loading YAML config:", error);
      }
    }

    // Fallback to environment variables
    console.log("Using configuration from environment variables");
    return this.loadFromEnvironment();
  }

  /**
   * Merge partial config with defaults
   */
  private mergeWithDefaults(partial: Partial<FiLineWallConfig>): FiLineWallConfig {
    return {
      modem: {
        ...DEFAULT_CONFIG.modem,
        ...partial.modem
      },
      callScreening: {
        ...DEFAULT_CONFIG.callScreening,
        autoBlockThreshold: {
          ...DEFAULT_CONFIG.callScreening.autoBlockThreshold,
          ...partial.callScreening?.autoBlockThreshold
        },
        ...partial.callScreening
      },
      notifications: {
        discord: {
          ...DEFAULT_CONFIG.notifications.discord,
          ...partial.notifications?.discord
        },
        telegram: {
          ...DEFAULT_CONFIG.notifications.telegram,
          ...partial.notifications?.telegram
        }
      },
      externalSources: {
        ...DEFAULT_CONFIG.externalSources,
        ...partial.externalSources
      },
      logging: {
        ...DEFAULT_CONFIG.logging,
        ...partial.logging
      }
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): FiLineWallConfig {
    return {
      modem: {
        device: process.env.MODEM_DEVICE || DEFAULT_CONFIG.modem.device,
        baudRate: parseInt(process.env.MODEM_BAUD_RATE || String(DEFAULT_CONFIG.modem.baudRate), 10),
        callerIdEnabled: process.env.CALLER_ID_ENABLED !== "false"
      },
      callScreening: {
        minCallDuration: parseInt(process.env.MIN_CALL_DURATION || String(DEFAULT_CONFIG.callScreening.minCallDuration), 10),
        autoBlockThreshold: {
          callsPerDay: parseInt(process.env.AUTO_BLOCK_CALLS_PER_DAY || String(DEFAULT_CONFIG.callScreening.autoBlockThreshold.callsPerDay), 10),
          repeatWithinMinutes: parseInt(process.env.AUTO_BLOCK_REPEAT_MINUTES || String(DEFAULT_CONFIG.callScreening.autoBlockThreshold.repeatWithinMinutes), 10)
        },
        ivrEnabled: process.env.IVR_ENABLED === "true",
        voicemailEnabled: process.env.VOICEMAIL_ENABLED === "true"
      },
      notifications: {
        discord: {
          enabled: !!process.env.DISCORD_WEBHOOK_URL,
          webhookUrl: process.env.DISCORD_WEBHOOK_URL
        },
        telegram: {
          enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID
        }
      },
      externalSources: {
        enabled: process.env.EXTERNAL_SOURCES_ENABLED !== "false",
        sources: process.env.EXTERNAL_SOURCES?.split(",") || DEFAULT_CONFIG.externalSources.sources
      },
      logging: {
        logPath: process.env.LOG_PATH || DEFAULT_CONFIG.logging.logPath,
        dbPath: process.env.DB_PATH || DEFAULT_CONFIG.logging.dbPath,
        voicemailPath: process.env.VOICEMAIL_PATH || DEFAULT_CONFIG.logging.voicemailPath
      }
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): FiLineWallConfig {
    return this.config;
  }

  /**
   * Get a specific config value
   */
  get<K extends keyof FiLineWallConfig>(key: K): FiLineWallConfig[K] {
    return this.config[key];
  }

  /**
   * Save current configuration to YAML file
   */
  saveConfig(): void {
    try {
      const yamlStr = yaml.dump(this.config);
      const dir = path.dirname(this.configPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, yamlStr, "utf8");
      console.log(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error("Error saving config:", error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FiLineWallConfig>): void {
    this.config = this.mergeWithDefaults({
      ...this.config,
      ...updates
    });
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.config = this.loadConfig();
  }
}

// Singleton instance
export const configService = new ConfigService();
