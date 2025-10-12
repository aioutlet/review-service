/**
 * Observability module exports
 * Centralized access to all observability functionality including logging and tracing
 */

// Logging exports
import logger from './logging/index.js';
export default logger;

export { Logger } from './logging/index.js';
export {
  LOG_LEVELS,
  DEFAULT_CONFIG,
  ENVIRONMENT_CONFIGS,
  validateLogEntry,
  createBaseLogEntry,
} from './logging/index.js';

// Tracing exports
export {
  initializeTracing,
  shutdownTracing,
  isTracingEnabled,
  getTracingContext,
  createOperationSpan,
} from './tracing/index.js';
