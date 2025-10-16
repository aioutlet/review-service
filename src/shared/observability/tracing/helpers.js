import { trace } from '@opentelemetry/api';
import { isTracingEnabled } from './setup.js';

/**
 * Tracing helper functions
 */

/**
 * Get service information from environment variables
 * @returns {Object} Object containing serviceName and serviceVersion
 */
export function getServiceInfo() {
  return {
    serviceName: process.env.SERVICE_NAME || process.env.OTEL_SERVICE_NAME || 'review-service',
    serviceVersion: process.env.SERVICE_VERSION || process.env.OTEL_SERVICE_VERSION || '1.0.0',
  };
}

/**
 * Get current trace and span IDs from OpenTelemetry context
 * @returns {Object} Object containing traceId and spanId
 */
export function getTracingContext() {
  if (!isTracingEnabled()) {
    return { traceId: null, spanId: null };
  }

  try {
    const span = trace.getActiveSpan();
    if (!span) {
      return { traceId: null, spanId: null };
    }

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId || null,
      spanId: spanContext.spanId || null,
    };
  } catch (error) {
    // If OpenTelemetry is not properly initialized, return nulls
    console.debug('Failed to get tracing context:', error.message);
    return { traceId: null, spanId: null };
  }
}

/**
 * Create a new span for operation tracking
 * @param {string} operationName - Name of the operation
 * @param {Object} [attributes] - Additional attributes for the span
 * @returns {Object} Span object with context
 */
export function createOperationSpan(operationName, attributes = {}) {
  if (!isTracingEnabled()) {
    return {
      span: null,
      traceId: null,
      spanId: null,
      end: () => {},
      setStatus: () => {},
      addEvent: () => {},
      setAttributes: () => {},
    };
  }

  try {
    const { serviceName, serviceVersion } = getServiceInfo();

    const tracer = trace.getTracer(serviceName, serviceVersion);
    const span = tracer.startSpan(operationName, {
      attributes: {
        'service.name': serviceName,
        'service.version': serviceVersion,
        ...attributes,
      },
    });

    return {
      span,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      end: () => span.end(),
      setStatus: (code, message) => span.setStatus({ code, message }),
      addEvent: (name, attributes) => span.addEvent(name, attributes),
      setAttributes: (attrs) => span.setAttributes(attrs),
    };
  } catch (error) {
    // Return a no-op span if tracing fails
    console.debug('Failed to create operation span:', error.message);
    return {
      span: null,
      traceId: null,
      spanId: null,
      end: () => {},
      setStatus: () => {},
      addEvent: () => {},
      setAttributes: () => {},
    };
  }
}
