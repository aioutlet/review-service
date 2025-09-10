/**
 * Legacy logger compatibility wrapper
 * This maintains backward compatibility while using the new observability system
 */

import logger from '../observability/index.js';
import config from '../config/index.js';
import fs from 'fs';

// Ensure logs directory exists for backward compatibility
const logDir = config.logging?.dir || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Add correlation ID helper method for backward compatibility
logger.withCorrelationId = (correlationId) => {
  return {
    error: (message, meta = {}) => logger.error(message, null, { ...meta, correlationId }),
    warn: (message, meta = {}) => logger.warn(message, null, { ...meta, correlationId }),
    info: (message, meta = {}) => logger.info(message, null, { ...meta, correlationId }),
    debug: (message, meta = {}) => logger.debug(message, null, { ...meta, correlationId }),
  };
};

export default logger;
