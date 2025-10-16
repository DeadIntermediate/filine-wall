import { z } from 'zod';

// Configuration schema for validation
const configSchema = z.object({
  // Database configuration
  database: z.object({
    url: z.string().url('Invalid database URL'),
    maxConnections: z.number().min(1).max(100).default(10),
    ssl: z.boolean().default(false),
    connectionTimeout: z.number().default(30000),
  }),

  // JWT configuration
  jwt: z.object({
    secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    expiryTime: z.string().default('24h'),
    refreshExpiryTime: z.string().default('7d'),
  }),

  // Server configuration
  server: z.object({
    port: z.number().min(1).max(65535).default(5000),
    host: z.string().default('0.0.0.0'),
    corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
    rateLimitWindowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    rateLimitMaxRequests: z.number().default(100),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'console']).default('console'),
    enableRequestLogging: z.boolean().default(true),
  }),

  // External services
  services: z.object({
    twilio: z.object({
      accountSid: z.string().optional(),
      authToken: z.string().optional(),
      enabled: z.boolean().default(false),
    }).optional(),
    
    discord: z.object({
      webhookUrl: z.string().url().optional(),
      enabled: z.boolean().default(false),
    }).optional(),
    
    telegram: z.object({
      botToken: z.string().optional(),
      chatId: z.string().optional(),
      enabled: z.boolean().default(false),
    }).optional(),
  }),

  // Security settings
  security: z.object({
    bcryptSaltRounds: z.number().min(10).max(15).default(12),
    sessionTimeout: z.number().default(24 * 60 * 60 * 1000), // 24 hours
    maxLoginAttempts: z.number().default(5),
    lockoutDuration: z.number().default(15 * 60 * 1000), // 15 minutes
    enableCsrfProtection: z.boolean().default(true),
  }),

  // Feature flags
  features: z.object({
    voiceAnalysis: z.boolean().default(true),
    mlSpamDetection: z.boolean().default(true),
    geographicBlocking: z.boolean().default(false),
    ivrChallenge: z.boolean().default(true),
    deviceEncryption: z.boolean().default(true),
  }),

  // Environment
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    const rawConfig = {
      database: {
        url: this.getEnvVar('DATABASE_URL', true),
        maxConnections: this.getEnvNumber('DB_MAX_CONNECTIONS', 10),
        ssl: this.getEnvBoolean('DB_SSL', false),
        connectionTimeout: this.getEnvNumber('DB_CONNECTION_TIMEOUT', 30000),
      },
      jwt: {
        secret: this.getEnvVar('JWT_SECRET', true),
        expiryTime: this.getEnvVar('JWT_EXPIRY_TIME', false, '24h'),
        refreshExpiryTime: this.getEnvVar('JWT_REFRESH_EXPIRY_TIME', false, '7d'),
      },
      server: {
        port: this.getEnvNumber('PORT', 5000),
        host: this.getEnvVar('HOST', false, '0.0.0.0'),
        corsOrigins: this.getEnvArray('CORS_ORIGINS', ['http://localhost:3000']),
        rateLimitWindowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        rateLimitMaxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      },
      logging: {
        level: this.getEnvVar('LOG_LEVEL', false, 'info') as 'debug' | 'info' | 'warn' | 'error',
        format: this.getEnvVar('LOG_FORMAT', false, 'console') as 'json' | 'console',
        enableRequestLogging: this.getEnvBoolean('ENABLE_REQUEST_LOGGING', true),
      },
      services: {
        twilio: {
          accountSid: this.getEnvVar('TWILIO_ACCOUNT_SID', false),
          authToken: this.getEnvVar('TWILIO_AUTH_TOKEN', false),
          enabled: this.getEnvBoolean('TWILIO_ENABLED', false),
        },
        discord: {
          webhookUrl: this.getEnvVar('DISCORD_WEBHOOK_URL', false),
          enabled: this.getEnvBoolean('DISCORD_ENABLED', false),
        },
        telegram: {
          botToken: this.getEnvVar('TELEGRAM_BOT_TOKEN', false),
          chatId: this.getEnvVar('TELEGRAM_CHAT_ID', false),
          enabled: this.getEnvBoolean('TELEGRAM_ENABLED', false),
        },
      },
      security: {
        bcryptSaltRounds: this.getEnvNumber('BCRYPT_SALT_ROUNDS', 12),
        sessionTimeout: this.getEnvNumber('SESSION_TIMEOUT', 24 * 60 * 60 * 1000),
        maxLoginAttempts: this.getEnvNumber('MAX_LOGIN_ATTEMPTS', 5),
        lockoutDuration: this.getEnvNumber('LOCKOUT_DURATION', 15 * 60 * 1000),
        enableCsrfProtection: this.getEnvBoolean('ENABLE_CSRF_PROTECTION', true),
      },
      features: {
        voiceAnalysis: this.getEnvBoolean('FEATURE_VOICE_ANALYSIS', true),
        mlSpamDetection: this.getEnvBoolean('FEATURE_ML_SPAM_DETECTION', true),
        geographicBlocking: this.getEnvBoolean('FEATURE_GEOGRAPHIC_BLOCKING', false),
        ivrChallenge: this.getEnvBoolean('FEATURE_IVR_CHALLENGE', true),
        deviceEncryption: this.getEnvBoolean('FEATURE_DEVICE_ENCRYPTION', true),
      },
      environment: (this.getEnvVar('NODE_ENV', false, 'development') as 'development' | 'staging' | 'production'),
    };

    try {
      return configSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join('\n');
        throw new Error(`Configuration validation failed:\n${errorMessage}`);
      }
      throw error;
    }
  }

  private getEnvVar(key: string, required: boolean, defaultValue?: string): string {
    const value = process.env[key];
    
    if (!value) {
      if (required) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
      return defaultValue || '';
    }
    
    return value;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    
    return parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }

  private getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  public get(): Config {
    return this.config;
  }

  public reload(): void {
    this.config = this.loadConfig();
  }

  // Convenience getters for commonly used config values
  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.environment === 'production';
  }

  public getLogLevel(): string {
    return this.config.logging.level;
  }

  public getDatabaseUrl(): string {
    return this.config.database.url;
  }

  public getJwtSecret(): string {
    return this.config.jwt.secret;
  }

  public getServerPort(): number {
    return this.config.server.port;
  }

  public isFeatureEnabled(feature: keyof Config['features']): boolean {
    return this.config.features[feature];
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();
export default config;