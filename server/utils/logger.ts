import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = LogLevel[entry.level];
    const context = entry.context ? `[${entry.context}]` : '';
    
    if (this.isDevelopment) {
      // Colorized output for development
      const levelColor = this.getLevelColor(entry.level);
      return `${chalk.gray(timestamp)} ${levelColor(level.padEnd(5))} ${chalk.cyan(context)} ${entry.message}`;
    } else {
      // JSON structured logging for production
      return JSON.stringify({
        timestamp,
        level,
        context: entry.context,
        message: entry.message,
        metadata: entry.metadata,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined
      });
    }
  }

  private getLevelColor(level: LogLevel): (text: string) => string {
    switch (level) {
      case LogLevel.DEBUG: return chalk.gray;
      case LogLevel.INFO: return chalk.blue;
      case LogLevel.WARN: return chalk.yellow;
      case LogLevel.ERROR: return chalk.red;
      default: return chalk.white;
    }
  }

  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
      error
    };

    const formattedMessage = this.formatMessage(entry);
    
    if (level >= LogLevel.ERROR) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, metadata, error);
  }

  // Request logging middleware
  requestLogger() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();
      const originalSend = res.json;

      res.json = function(body: any) {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? chalk.red : chalk.green;
        
        logger.info(
          `${req.method} ${req.path} ${statusColor(res.statusCode)} - ${duration}ms`,
          'HTTP',
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        );

        return originalSend.call(this, body);
      };

      next();
    };
  }
}

export const logger = new Logger();

// Export convenience methods
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  requestLogger: logger.requestLogger.bind(logger)
};

export default logger;