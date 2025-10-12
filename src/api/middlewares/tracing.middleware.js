/**
 * Tracing middleware for review service
 * Adds tracing context to requests and enhances observability
 */

import { createOperationSpan, getTracingContext } from '../shared/observability/tracing/helpers.js';
import logger from '../shared/observability/index.js';

/**
 * Middleware to add tracing context to requests
 */
export const tracingMiddleware = (req, res, next) => {
  // Create a span for the HTTP request
  const operationName = `${req.method} ${req.route?.path || req.path}`;
  const span = createOperationSpan(operationName, {
    'http.method': req.method,
    'http.url': req.originalUrl,
    'http.route': req.route?.path || req.path,
    'http.user_agent': req.get('User-Agent'),
    'user.id': req.user?.id,
  });

  // Add tracing context to request
  req.tracing = {
    span,
    traceId: span.traceId,
    spanId: span.spanId,
    operationName,
  };

  // Add tracing context to response headers for debugging
  if (span.traceId) {
    res.set('X-Trace-Id', span.traceId);
  }

  // Override res.end to complete the span
  const originalEnd = res.end;
  res.end = function (...args) {
    // Set span status based on response
    const statusCode = res.statusCode;
    if (statusCode >= 400) {
      span.setStatus(2, `HTTP ${statusCode}`); // ERROR status
    } else {
      span.setStatus(1); // OK status
    }

    // Add response attributes
    span.addEvent('http.response', {
      'http.status_code': statusCode,
      'http.response_size': res.get('Content-Length') || 0,
    });

    // End the span
    span.end();

    // Call original end
    originalEnd.apply(this, args);
  };

  // Log the request start
  logger.debug(`Starting HTTP request: ${operationName}`, req, {
    operation: 'http_request_start',
    metadata: {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      traceId: span.traceId,
      spanId: span.spanId,
    },
  });

  next();
};

/**
 * Enhanced error middleware with tracing
 */
export const tracingErrorMiddleware = (error, req, res, next) => {
  // Add error information to current span
  if (req.tracing?.span) {
    req.tracing.span.setStatus(2, error.message); // ERROR status
    req.tracing.span.addEvent('error', {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
    });
  }

  // Log the error with tracing context
  logger.error('HTTP request error', req, {
    operation: 'http_request_error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    metadata: {
      method: req.method,
      url: req.originalUrl,
      statusCode: error.statusCode || 500,
      traceId: req.tracing?.traceId,
      spanId: req.tracing?.spanId,
    },
  });

  next(error);
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Override res.end to measure performance
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Log performance metrics
    logger.performance(`${req.method} ${req.route?.path || req.path}`, duration, req, {
      metadata: {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length') || 0,
      },
    });

    // Add performance event to span
    if (req.tracing?.span) {
      req.tracing.span.addEvent('performance', {
        'http.duration_ms': duration,
        'http.status_code': res.statusCode,
      });
    }

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

export default {
  tracingMiddleware,
  tracingErrorMiddleware,
  performanceMiddleware,
};
