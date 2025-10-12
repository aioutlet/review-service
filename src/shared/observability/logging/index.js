/**
 * Logging module exports
 * Provides centralized access to all logging functionality
 */

import Logger from './logger.js';

// Create and export the logger instance
const logger = new Logger();

export default logger;

// Also export the Logger class for advanced usage
export { Logger };

// Export schemas and utilities
export { LOG_LEVELS, DEFAULT_CONFIG, ENVIRONMENT_CONFIGS, validateLogEntry, createBaseLogEntry } from './schemas.js';

// Export formatters
export { createJsonFormat, createConsoleFormat } from './formatters.js';
