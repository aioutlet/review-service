/**
 * Unified Logging Schema for AIOutlet Services
 * This schema standardizes logging across all microservices regardless of technology stack
 *
 * @typedef {Object} StandardLogEntry
 * @property {string} timestamp - ISO 8601 timestamp (e.g., "2025-08-31T10:00:00.000Z")
 * @property {"DEBUG"|"INFO"|"WARN"|"ERROR"|"FATAL"} level - Log level
 * @property {string} service - Service name (e.g., "review-service")
 * @property {string} version - Service version (e.g., "1.0.0")
 * @property {string} environment - Environment (development|staging|production)
 * @property {string|null} correlationId - Request correlation UUID
 * @property {string} [traceId] - Distributed tracing trace ID
 * @property {string} [spanId] - Distributed tracing span ID
 * @property {string} message - Human readable log message
 * @property {string} [operation] - Operation or method name
 * @property {number} [duration] - Duration in milliseconds
 * @property {string} [userId] - User identifier
 * @property {string} [businessEvent] - Business event type
 * @property {string} [securityEvent] - Security event type
 * @property {ErrorInfo} [error] - Error information
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {string} name - Error name/type
 * @property {string} message - Error message
 * @property {string} [stack] - Stack trace
 */

/**
 * @typedef {Object} LoggerConfig
 * @property {string} serviceName - Name of the service
 * @property {string} version - Version of the service
 * @property {string} environment - Current environment
 * @property {boolean} enableConsole - Enable console logging
 * @property {boolean} enableFile - Enable file logging
 * @property {"DEBUG"|"INFO"|"WARN"|"ERROR"|"FATAL"} logLevel - Minimum log level
 * @property {"json"|"console"} format - Output format
 * @property {string} [filePath] - Log file path (if file logging enabled)
 * @property {boolean} [enableTracing] - Enable OpenTelemetry tracing integration
 */

/**
 * Log levels with numeric values for comparison
 */
export const LOG_LEVELS = {
  DEBUG: { value: 0, name: 'DEBUG' },
  INFO: { value: 1, name: 'INFO' },
  WARN: { value: 2, name: 'WARN' },
  ERROR: { value: 3, name: 'ERROR' },
  FATAL: { value: 4, name: 'FATAL' },
};

/**
 * Default logger configuration
 */
export const DEFAULT_CONFIG = {
  serviceName: 'review-service',
  version: '1.0.0',
  environment: 'development',
  enableConsole: true,
  enableFile: false,
  logLevel: 'INFO',
  format: 'console',
  enableTracing: true,
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS = {
  local: {
    ...DEFAULT_CONFIG,
    logLevel: 'DEBUG',
    format: 'console',
    enableFile: true,
    enableTracing: true,
  },
  development: {
    ...DEFAULT_CONFIG,
    logLevel: 'DEBUG',
    format: 'console',
    enableFile: false,
    enableTracing: false,
  },
  staging: {
    ...DEFAULT_CONFIG,
    logLevel: 'INFO',
    format: 'json',
    enableFile: true,
    enableTracing: true,
  },
  production: {
    ...DEFAULT_CONFIG,
    logLevel: 'INFO',
    format: 'json',
    enableFile: true,
    enableTracing: true,
  },
  test: {
    ...DEFAULT_CONFIG,
    logLevel: 'ERROR',
    format: 'json',
    enableConsole: false,
    enableFile: false,
    enableTracing: false,
  },
};

/**
 * Validates a log entry against the unified schema
 * @param {Object} logEntry - Log entry to validate
 * @returns {boolean} - True if valid
 */
export function validateLogEntry(logEntry) {
  const required = ['timestamp', 'level', 'service', 'version', 'environment', 'message'];

  // Check required fields
  for (const field of required) {
    if (!logEntry.hasOwnProperty(field) || logEntry[field] === null || logEntry[field] === undefined) {
      return false;
    }
  }

  // Validate level
  if (!Object.keys(LOG_LEVELS).includes(logEntry.level)) {
    return false;
  }

  // Validate timestamp format (basic ISO 8601 check)
  if (!logEntry.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)) {
    return false;
  }

  return true;
}

/**
 * Creates a base log entry with standard fields
 * @param {LoggerConfig} config - Logger configuration
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [additionalData] - Additional data to include
 * @returns {StandardLogEntry} - Standardized log entry
 */
export function createBaseLogEntry(config, level, message, additionalData = {}) {
  const baseEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: config.serviceName,
    version: config.version,
    environment: config.environment,
    correlationId: additionalData.correlationId || null,
    message: message,
  };

  // Add optional fields if they exist
  const optionalFields = [
    'traceId',
    'spanId',
    'operation',
    'duration',
    'userId',
    'businessEvent',
    'securityEvent',
    'error',
    'metadata',
  ];

  optionalFields.forEach((field) => {
    if (additionalData[field] !== undefined && additionalData[field] !== null) {
      baseEntry[field] = additionalData[field];
    }
  });

  return baseEntry;
}
