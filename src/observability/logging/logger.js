import winston from 'winston';
import { LOG_LEVELS, DEFAULT_CONFIG, ENVIRONMENT_CONFIGS, validateLogEntry } from './schemas.js';
import { createJsonFormat, createConsoleFormat } from './formatters.js';

/**
 * Logger class implementing the unified logging schema
 */
class Logger {
  constructor(config = {}) {
    // Get environment-specific config
    const environment = process.env.NODE_ENV || 'development';
    const envConfig = ENVIRONMENT_CONFIGS[environment] || ENVIRONMENT_CONFIGS.development;

    // Get service name early for path calculation
    const serviceName = process.env.SERVICE_NAME || config.serviceName || envConfig.serviceName;

    // Merge configurations: env vars > passed config > env defaults > global defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...envConfig,
      ...config,
      // Override with environment variables
      serviceName: serviceName,
      version: this._getServiceVersion(),
      environment: environment,
      logLevel: process.env.LOG_LEVEL || config.logLevel || envConfig.logLevel,
      format: process.env.LOG_FORMAT || config.format || envConfig.format,
      enableConsole: this._parseBoolean(process.env.LOG_TO_CONSOLE, envConfig.enableConsole),
      enableFile: this._parseBoolean(process.env.LOG_TO_FILE, envConfig.enableFile),
      enableTracing: this._parseBoolean(process.env.ENABLE_TRACING, envConfig.enableTracing),
      filePath: process.env.LOG_FILE_PATH || config.filePath || this._getDefaultLogPath(environment, serviceName),
    };

    // Initialize Winston logger
    this._initializeWinston();

    // Log initialization
    this.info('Logger initialized', null, {
      operation: 'logger_initialization',
      metadata: {
        config: {
          ...this.config,
          // Don't log sensitive paths in production
          filePath: this.config.environment === 'production' ? '[REDACTED]' : this.config.filePath,
        },
      },
    });
  }

  /**
   * Get service version from package.json
   */
  _getServiceVersion() {
    try {
      return process.env.SERVICE_VERSION || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Parse boolean from environment variable or return default
   */
  _parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return value === 'true' || value === true;
  }

  /**
   * Get default log file path based on environment
   */
  _getDefaultLogPath(environment, serviceName) {
    const isDevelopment = environment === 'development';
    return isDevelopment ? `./logs/${serviceName}.log` : `/app/logs/${serviceName}.log`;
  }

  /**
   * Initialize Winston logger with unified schema formatting
   */
  _initializeWinston() {
    const transports = [];

    // Console transport
    if (this.config.enableConsole && this.config.environment !== 'test') {
      transports.push(
        new winston.transports.Console({
          format: this.config.format === 'json' ? createJsonFormat(this.config) : createConsoleFormat(this.config),
          level: this.config.logLevel.toLowerCase(),
        })
      );
    }

    // File transport
    if (this.config.enableFile) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          format: createJsonFormat(this.config),
          level: this.config.logLevel.toLowerCase(),
        })
      );
    }

    // Exception and rejection handlers
    const exceptionHandlers = [];
    const rejectionHandlers = [];

    if (this.config.enableFile) {
      exceptionHandlers.push(
        new winston.transports.File({
          filename: this.config.filePath.replace('.log', '-exceptions.log'),
        })
      );
      rejectionHandlers.push(
        new winston.transports.File({
          filename: this.config.filePath.replace('.log', '-rejections.log'),
        })
      );
    }

    if (this.config.enableConsole && this.config.environment !== 'test') {
      exceptionHandlers.push(
        new winston.transports.Console({
          format: createConsoleFormat(this.config),
        })
      );
      rejectionHandlers.push(
        new winston.transports.Console({
          format: createConsoleFormat(this.config),
        })
      );
    }

    // Create Winston logger
    this.winston = winston.createLogger({
      level: this.config.logLevel.toLowerCase(),
      transports,
      exitOnError: false,
      exceptionHandlers,
      rejectionHandlers,
    });
  }

  /**
   * Core logging method
   */
  _log(level, message, req = null, additionalData = {}) {
    if (!this._shouldLog(level)) {
      return;
    }

    const logData = {
      level: level.toLowerCase(),
      message,
      correlationId: req?.correlationId || additionalData.correlationId || null,
      userId: req?.user?.id || additionalData.userId || null,
      operation: additionalData.operation || null,
      duration: additionalData.duration || null,
      businessEvent: additionalData.businessEvent || null,
      securityEvent: additionalData.securityEvent || null,
      error: this._processError(additionalData.error),
      metadata: additionalData.metadata || null,
    };

    // Remove null/undefined values
    Object.keys(logData).forEach((key) => {
      if (logData[key] === null || logData[key] === undefined) {
        delete logData[key];
      }
    });

    this.winston.log(logData);
  }

  /**
   * Process error object to ensure it's serializable
   */
  _processError(error) {
    if (!error) {
      return null;
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return error;
  }

  /**
   * Check if we should log at this level
   */
  _shouldLog(level) {
    const currentLevelValue = LOG_LEVELS[this.config.logLevel.toUpperCase()]?.value || 1;
    const logLevelValue = LOG_LEVELS[level.toUpperCase()]?.value || 1;
    return logLevelValue >= currentLevelValue;
  }

  // Public logging methods

  /**
   * Debug level logging
   */
  debug(message, req = null, additionalData = {}) {
    this._log('DEBUG', message, req, additionalData);
  }

  /**
   * Info level logging
   */
  info(message, req = null, additionalData = {}) {
    this._log('INFO', message, req, additionalData);
  }

  /**
   * Warning level logging
   */
  warn(message, req = null, additionalData = {}) {
    this._log('WARN', message, req, additionalData);
  }

  /**
   * Error level logging
   */
  error(message, req = null, additionalData = {}) {
    this._log('ERROR', message, req, additionalData);
  }

  /**
   * Fatal level logging
   */
  fatal(message, req = null, additionalData = {}) {
    this._log('FATAL', message, req, additionalData);
  }

  // Convenience methods

  /**
   * Log operation start
   */
  operationStart(operation, req = null, additionalData = {}) {
    this.debug(`Starting operation: ${operation}`, req, {
      operation,
      operationStart: true,
      ...additionalData,
    });
    return Date.now();
  }

  /**
   * Log operation completion
   */
  operationComplete(operation, startTime, req = null, additionalData = {}) {
    const duration = Date.now() - startTime;
    this.info(`Completed operation: ${operation}`, req, {
      operation,
      duration,
      operationComplete: true,
      ...additionalData,
    });
    return duration;
  }

  /**
   * Log operation failure
   */
  operationFailed(operation, startTime, error, req = null, additionalData = {}) {
    const duration = Date.now() - startTime;
    this.error(`Failed operation: ${operation}`, req, {
      operation,
      duration,
      error,
      operationFailed: true,
      ...additionalData,
    });
    return duration;
  }

  /**
   * Log business events
   */
  business(event, req = null, additionalData = {}) {
    this.info(`Business event: ${event}`, req, {
      businessEvent: event,
      ...additionalData,
    });
  }

  /**
   * Log security events
   */
  security(event, req = null, additionalData = {}) {
    this.warn(`Security event: ${event}`, req, {
      securityEvent: event,
      ...additionalData,
    });
  }

  /**
   * Log performance metrics
   */
  performance(operation, duration, req = null, additionalData = {}) {
    const level = duration > 1000 ? 'warn' : 'info';
    this._log(level.toUpperCase(), `Performance: ${operation}`, req, {
      operation,
      duration,
      performance: true,
      ...additionalData,
    });
  }

  /**
   * Validate log entry against unified schema
   */
  validateEntry(entry) {
    return validateLogEntry(entry);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

export default Logger;
