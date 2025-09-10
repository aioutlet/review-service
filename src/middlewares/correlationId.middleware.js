import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to add correlation ID to requests
 * Correlation ID helps track requests across microservices
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const correlationIdMiddleware = (req, res, next) => {
  // Try to get correlation ID from various headers
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['correlation-id'] ||
    req.headers['x-request-id'] ||
    req.headers['request-id'] ||
    uuidv4();

  // Add correlation ID to request object
  req.correlationId = correlationId;

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Create logger with correlation ID for this request
  req.logger = req.app.locals.logger?.withCorrelationId?.(correlationId) || console;

  next();
};

export default correlationIdMiddleware;
