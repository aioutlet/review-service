import winston from 'winston';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const NAME = process.env.NAME || 'review-service';
const LOG_FORMAT = process.env.LOG_FORMAT || (IS_PRODUCTION ? 'json' : 'console');

/**
 * Console formatter for development
 */
const consoleFormat = winston.format.printf(({ level, message, timestamp, correlationId, ...meta }) => {
  const colors = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[32m',
    debug: '\x1b[34m',
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';

  const corrId = correlationId ? `[${correlationId}]` : '[no-correlation]';
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

  return `${color}[${timestamp}] [${level.toUpperCase()}] ${NAME} ${corrId}: ${message}${metaStr}${reset}`;
});

/**
 * JSON formatter for production
 */
const jsonFormat = winston.format.printf(({ level, message, timestamp, correlationId, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    service: NAME,
    correlationId: correlationId || null,
    message,
    ...meta,
  });
});

/**
 * Create Winston logger
 */
const createWinstonLogger = () => {
  const transports = [];

  // Console transport
  if (!IS_TEST) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), LOG_FORMAT === 'json' ? jsonFormat : consoleFormat),
      })
    );
  }

  // File transport
  if (process.env.LOG_TO_FILE === 'true') {
    transports.push(
      new winston.transports.File({
        filename: `./logs/${NAME}.log`,
        format: winston.format.combine(winston.format.timestamp(), jsonFormat),
      })
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || (IS_DEVELOPMENT ? 'debug' : 'info'),
    transports,
    exitOnError: false,
  });
};

const winstonLogger = createWinstonLogger();

/**
 * Standard logger with correlation ID support
 */
class Logger {
  _log(level, message, metadata = {}) {
    // Remove null/undefined values
    const cleanMeta = Object.entries(metadata).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        // Handle error objects
        if (key === 'error' && value instanceof Error) {
          acc[key] = {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    winstonLogger.log(level, message, cleanMeta);
  }

  debug(message, metadata = {}) {
    this._log('debug', message, metadata);
  }

  info(message, metadata = {}) {
    this._log('info', message, metadata);
  }

  warn(message, metadata = {}) {
    this._log('warn', message, metadata);
  }

  error(message, metadata = {}) {
    this._log('error', message, metadata);
  }

  /**
   * Create a logger bound to a correlation ID
   */
  withCorrelationId(correlationId) {
    return {
      debug: (message, metadata = {}) => this.debug(message, { ...metadata, correlationId }),
      info: (message, metadata = {}) => this.info(message, { ...metadata, correlationId }),
      warn: (message, metadata = {}) => this.warn(message, { ...metadata, correlationId }),
      error: (message, metadata = {}) => this.error(message, { ...metadata, correlationId }),
    };
  }
}

export const logger = new Logger();
export default logger;
