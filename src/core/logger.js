import winston from 'winston';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const NAME = process.env.NAME || 'review-service';
const LOG_FORMAT = process.env.LOG_FORMAT || (IS_PRODUCTION ? 'json' : 'console');

/**
 * Console formatter for development
 */
const consoleFormat = winston.format.printf(
  ({ level, message, timestamp, traceId, spanId, correlationId, ...meta }) => {
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[32m',
      debug: '\x1b[34m',
    };
    const reset = '\x1b[0m';
    const color = colors[level] || '';

    // Prefer W3C trace context, fallback to correlationId for backward compatibility
    const traceInfo =
      traceId && spanId
        ? `[${traceId.substring(0, 8)}...${spanId}]`
        : correlationId
        ? `[${correlationId}]`
        : '[no-trace]';

    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

    return `${color}[${timestamp}] [${level.toUpperCase()}] ${NAME} ${traceInfo}: ${message}${metaStr}${reset}`;
  }
);

/**
 * JSON formatter for production
 */
const jsonFormat = winston.format.printf(({ level, message, timestamp, traceId, spanId, correlationId, ...meta }) => {
  const logEntry = {
    timestamp,
    level,
    service: NAME,
    message,
    ...meta,
  };

  // Include W3C trace context if available
  if (traceId) logEntry.traceId = traceId;
  if (spanId) logEntry.spanId = spanId;

  // Include legacy correlationId for backward compatibility
  if (correlationId) logEntry.correlationId = correlationId;

  return JSON.stringify(logEntry);
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
   * Create a logger bound to a correlation ID (legacy support)
   * @deprecated Use withTraceContext instead
   */
  withCorrelationId(correlationId) {
    return {
      debug: (message, metadata = {}) => this.debug(message, { ...metadata, correlationId }),
      info: (message, metadata = {}) => this.info(message, { ...metadata, correlationId }),
      warn: (message, metadata = {}) => this.warn(message, { ...metadata, correlationId }),
      error: (message, metadata = {}) => this.error(message, { ...metadata, correlationId }),
    };
  }

  /**
   * Create a logger bound to W3C Trace Context
   * @param {string} traceId - W3C trace ID (32 hex chars)
   * @param {string} spanId - W3C span ID (16 hex chars)
   * @returns {Object} Logger with trace context bound to all methods
   */
  withTraceContext(traceId, spanId) {
    return {
      debug: (message, metadata = {}) => this.debug(message, { ...metadata, traceId, spanId }),
      info: (message, metadata = {}) => this.info(message, { ...metadata, traceId, spanId }),
      warn: (message, metadata = {}) => this.warn(message, { ...metadata, traceId, spanId }),
      error: (message, metadata = {}) => this.error(message, { ...metadata, traceId, spanId }),
    };
  }
}

export const logger = new Logger();
export default logger;
