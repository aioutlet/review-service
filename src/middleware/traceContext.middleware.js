/**
 * W3C Trace Context Middleware for Review Service
 * Extracts and propagates trace context using traceparent header
 * Specification: https://www.w3.org/TR/trace-context/
 */

/**
 * Extract W3C Trace Context from traceparent header
 * @param {string} traceparent - W3C traceparent header (format: version-traceId-spanId-flags)
 * @returns {Object|null} - { traceId, spanId } or null if invalid
 */
export function extractTraceContext(traceparent) {
  if (!traceparent || typeof traceparent !== 'string') {
    return null;
  }

  const parts = traceparent.split('-');
  
  // Valid traceparent format: 00-{traceId}-{spanId}-{flags}
  if (parts.length !== 4 || parts[0] !== '00') {
    return null;
  }

  const traceId = parts[1]; // 32 hex characters
  const spanId = parts[2];  // 16 hex characters

  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === '00000000000000000000000000000000') {
    return null;
  }

  // Validate span ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/.test(spanId) || spanId === '0000000000000000') {
    return null;
  }

  return { traceId, spanId };
}

/**
 * Generate a new trace context
 * @returns {Object} - { traceId, spanId }
 */
export function generateTraceContext() {
  const traceId = Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  
  const spanId = Array.from({ length: 16 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  return { traceId, spanId };
}

/**
 * Middleware to extract W3C Trace Context from requests
 * Supports traceparent header for distributed tracing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const traceContextMiddleware = (req, res, next) => {
  // Extract W3C traceparent header
  const traceparent = req.headers['traceparent'];
  
  // Try to extract trace context from header
  let traceContext = extractTraceContext(traceparent);

  // Generate new trace context if not provided or invalid
  if (!traceContext) {
    traceContext = generateTraceContext();
  }

  const { traceId, spanId } = traceContext;

  // Add trace context to request object
  req.traceId = traceId;
  req.spanId = spanId;

  // Add traceparent to response headers for propagation
  const responseTraceparent = `00-${traceId}-${spanId}-01`;
  res.setHeader('traceparent', responseTraceparent);

  // Create logger with trace context for this request
  req.logger = req.app.locals.logger?.withTraceContext?.(traceId, spanId) || console;

  // Legacy support: also add to correlationId for backward compatibility
  req.correlationId = traceId;

  next();
};

export default traceContextMiddleware;
