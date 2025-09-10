import winston from 'winston';
import { colorizeLevel } from '../../utils/colorize.js';
import { createBaseLogEntry } from './schemas.js';
import { getTracingContext } from '../tracing/helpers.js';

/**
 * Log formatters for different output types
 */

/**
 * Create unified log entry from Winston info object
 * @param {Object} config - Logger configuration
 * @param {Object} info - Winston info object
 * @returns {Object} - Unified log entry
 */
export function createUnifiedLogEntry(config, info) {
  // Get tracing context if enabled
  const tracingContext = config.enableTracing ? getTracingContext() : { traceId: null, spanId: null };

  // Create base entry
  const entry = createBaseLogEntry(config, info.level, info.message, {
    ...tracingContext,
    correlationId: info.correlationId || null,
    operation: info.operation || null,
    duration: info.duration || null,
    userId: info.userId || null,
    businessEvent: info.businessEvent || null,
    securityEvent: info.securityEvent || null,
    error: info.error || null,
    metadata: info.metadata || (hasExtraFields(info) ? extractMetadata(info) : null),
  });

  return entry;
}

/**
 * Check if info object has extra fields beyond standard ones
 * @param {Object} info - Winston info object
 * @returns {boolean} - True if has extra fields
 */
function hasExtraFields(info) {
  const standardFields = [
    'level',
    'message',
    'timestamp',
    'correlationId',
    'operation',
    'duration',
    'userId',
    'businessEvent',
    'securityEvent',
    'error',
    'metadata',
  ];
  return Object.keys(info).some((key) => !standardFields.includes(key));
}

/**
 * Extract metadata from info object
 * @param {Object} info - Winston info object
 * @returns {Object|null} - Extracted metadata or null
 */
function extractMetadata(info) {
  const standardFields = [
    'level',
    'message',
    'timestamp',
    'correlationId',
    'operation',
    'duration',
    'userId',
    'businessEvent',
    'securityEvent',
    'error',
    'metadata',
  ];

  const metadata = {};
  Object.keys(info).forEach((key) => {
    if (!standardFields.includes(key)) {
      metadata[key] = info[key];
    }
  });

  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Format message for console output
 * @param {Object} entry - Unified log entry
 * @returns {string} - Formatted console message
 */
export function formatConsoleMessage(entry) {
  const timestamp = entry.timestamp;
  const level = entry.level;
  const service = entry.service;
  const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '[no-correlation]';
  const traceInfo = entry.traceId ? `[trace:${entry.traceId.substring(0, 8)}]` : '';

  let message = `[${timestamp}] [${level}] ${service} ${correlationId}${traceInfo}: ${entry.message}`;

  // Add contextual information
  const contextFields = [];
  if (entry.operation) {
    contextFields.push(`operation=${entry.operation}`);
  }
  if (entry.duration) {
    contextFields.push(`duration=${entry.duration}ms`);
  }
  if (entry.userId) {
    contextFields.push(`userId=${entry.userId}`);
  }
  if (entry.businessEvent) {
    contextFields.push(`businessEvent=${entry.businessEvent}`);
  }
  if (entry.securityEvent) {
    contextFields.push(`securityEvent=${entry.securityEvent}`);
  }

  if (contextFields.length > 0) {
    message += ` | ${contextFields.join(', ')}`;
  }

  // Add metadata
  if (entry.metadata) {
    const metaStr = Object.entries(entry.metadata)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    message += ` | metadata: ${metaStr}`;
  }

  // Add error information
  if (entry.error) {
    message += ` | ERROR: ${entry.error.name}: ${entry.error.message}`;
  }

  return message;
}

/**
 * Create JSON format for structured logging
 * @param {Object} config - Logger configuration
 * @returns {winston.Format} - Winston JSON format
 */
export function createJsonFormat(config) {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const unifiedEntry = createUnifiedLogEntry(config, info);
      return JSON.stringify(unifiedEntry);
    })
  );
}

/**
 * Create console format for development
 * @param {Object} config - Logger configuration
 * @returns {winston.Format} - Winston console format
 */
export function createConsoleFormat(config) {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const unifiedEntry = createUnifiedLogEntry(config, info);
      const message = formatConsoleMessage(unifiedEntry);

      return config.environment === 'development' ? colorizeLevel(unifiedEntry.level.toLowerCase(), message) : message;
    })
  );
}
