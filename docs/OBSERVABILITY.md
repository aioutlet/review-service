# Observability Features - Review Service

This document describes the comprehensive observability features implemented in the review service, including distributed tracing, structured logging, performance monitoring, and health checks.

## 🔍 **Overview**

The review service implements a unified observability strategy that includes:

- **Distributed Tracing** with OpenTelemetry
- **Structured Logging** with correlation IDs
- **Performance Monitoring** with span metrics
- **Health Checks** for service monitoring
- **Error Tracking** with detailed context
- **Business Event Logging** for analytics

## 📊 **Distributed Tracing**

### Setup

The service uses OpenTelemetry for distributed tracing with automatic instrumentation:

```javascript
import { initializeTracing } from './observability/tracing/setup.js';
initializeTracing();
```

### Features

- **Automatic HTTP instrumentation** for all incoming requests
- **Database operation tracing** for MongoDB queries
- **Cache operation tracing** for Redis operations
- **Message broker tracing** for RabbitMQ operations
- **Custom span creation** for business operations

### Configuration

```bash
# Enable/disable tracing
ENABLE_TRACING=true

# OTLP endpoint for trace export
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Service identification
OTEL_SERVICE_NAME=review-service
OTEL_SERVICE_VERSION=1.0.0

# Sampling rate (0.0 to 1.0)
OTEL_SAMPLE_RATE=0.1
```

### Usage in Code

```javascript
import { createOperationSpan } from './observability/tracing/helpers.js';

async function createReview(reviewData, user, correlationId) {
  const span = createOperationSpan('review.create', {
    'user.id': user.userId,
    'product.id': reviewData.productId,
    'review.rating': reviewData.rating,
  });

  try {
    // Business logic here
    span.setStatus(1); // OK status
    span.addEvent('review_created', { 'review.id': review._id });
  } catch (error) {
    span.setStatus(2, error.message); // ERROR status
    throw error;
  } finally {
    span.end();
  }
}
```

## 📝 **Structured Logging**

### Unified Schema

All logs follow a standardized schema across microservices:

```json
{
  "timestamp": "2025-09-10T10:00:00.000Z",
  "level": "INFO",
  "service": "review-service",
  "version": "1.0.0",
  "environment": "production",
  "correlationId": "uuid-correlation-id",
  "traceId": "opentelemetry-trace-id",
  "spanId": "opentelemetry-span-id",
  "message": "Review created successfully",
  "operation": "createReview",
  "duration": 150,
  "userId": "user-123",
  "businessEvent": "review_created",
  "metadata": {
    "reviewId": "review-456",
    "productId": "product-789",
    "rating": 5
  }
}
```

### Configuration

```bash
# Log level (DEBUG, INFO, WARN, ERROR, FATAL)
LOG_LEVEL=info

# Log format (console, json)
LOG_FORMAT=json

# Output destinations
LOG_TO_FILE=true
LOG_TO_CONSOLE=true
LOG_DIR=./logs
```

### Usage Examples

```javascript
import logger from './observability/index.js';

// Basic logging
logger.info('User review created', req, {
  operation: 'createReview',
  userId: user.id,
  metadata: { reviewId: review._id },
});

// Business event logging
logger.business('review_created', req, {
  metadata: {
    reviewId: review._id,
    productId: review.productId,
    rating: review.rating,
  },
});

// Security event logging
logger.security('suspicious_voting_pattern', req, {
  userId: user.id,
  metadata: { votingFrequency: '50_votes_per_minute' },
});

// Performance logging
logger.performance('database_query', 250, req, {
  operation: 'find_reviews',
  metadata: { queryComplexity: 'high' },
});

// Operation tracking
const startTime = logger.operationStart('updateReview', req);
// ... business logic
logger.operationComplete('updateReview', startTime, req);
```

## 📈 **Performance Monitoring**

### Automatic Metrics

The service automatically tracks:

- **HTTP request duration** and status codes
- **Database operation latency**
- **Cache hit/miss ratios**
- **Memory and CPU usage**
- **Business operation timing**

### Custom Span Creation

```javascript
const span = createOperationSpan('review.validate_purchase', {
  'user.id': userId,
  'product.id': productId,
  'order.reference': orderReference,
});

// Add events to track progress
span.addEvent('purchase_validation_started');
span.addEvent('external_service_called', { service: 'order-service' });
span.addEvent('validation_completed', { is_valid: true });

span.end();
```

### Performance Thresholds

Operations are automatically flagged for review if they exceed thresholds:

- **HTTP requests** > 1000ms
- **Database queries** > 500ms
- **Cache operations** > 100ms
- **External service calls** > 2000ms

## 🔧 **Middleware Integration**

### Tracing Middleware

Automatically adds tracing context to all HTTP requests:

```javascript
app.use(tracingMiddleware);
app.use(performanceMiddleware);
app.use(tracingErrorMiddleware);
```

### Request Correlation

Each request gets a correlation ID that flows through all operations:

```javascript
// Automatically added by middleware
req.correlationId = 'uuid-v4';
req.tracing = {
  traceId: 'opentelemetry-trace-id',
  spanId: 'opentelemetry-span-id'
};

// Available in response headers
X-Correlation-ID: uuid-v4
X-Trace-ID: opentelemetry-trace-id
```

## 🏥 **Health Checks**

### Endpoints

- **`/health`** - Basic health check
- **`/health/ready`** - Readiness probe (dependencies check)
- **`/health/live`** - Liveness probe (service health)
- **`/metrics`** - Prometheus metrics

### Health Check Configuration

```bash
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_GRACE_PERIOD=10000
```

## 🚨 **Error Tracking**

### Enhanced Error Context

All errors include comprehensive context:

```javascript
{
  "level": "ERROR",
  "message": "Failed to create review",
  "error": {
    "name": "ValidationError",
    "message": "Invalid rating value",
    "stack": "..."
  },
  "operation": "createReview",
  "correlationId": "uuid",
  "traceId": "trace-id",
  "userId": "user-123",
  "metadata": {
    "productId": "product-456",
    "inputData": { "rating": "invalid" }
  }
}
```

### Error Categories

- **Validation Errors** - Input validation failures
- **Business Logic Errors** - Domain rule violations
- **External Service Errors** - Dependency failures
- **System Errors** - Infrastructure issues

## 📊 **Business Event Tracking**

### Tracked Events

- `review_created` - New review submission
- `review_approved` - Review moderation approval
- `review_rejected` - Review moderation rejection
- `review_flagged` - Review flagged by users
- `helpful_vote_cast` - Helpfulness voting
- `purchase_verified` - Purchase verification completed

### Event Schema

```javascript
logger.business('review_created', req, {
  userId: user.id,
  metadata: {
    reviewId: review._id,
    productId: review.productId,
    rating: review.rating,
    isVerifiedPurchase: review.isVerifiedPurchase,
    categories: review.categories,
  },
});
```

## 🔒 **Security Event Monitoring**

### Tracked Events

- `authentication_failure` - Failed login attempts
- `authorization_violation` - Access control violations
- `rate_limit_exceeded` - Rate limiting triggers
- `suspicious_activity` - Anomaly detection hits
- `data_access_violation` - Unauthorized data access

## 🛠 **Development Tools**

### Local Testing

```bash
# Start with tracing enabled
ENABLE_TRACING=true npm run dev

# View logs in structured format
tail -f logs/review-service.log | jq .

# Check health endpoints
curl http://localhost:9001/health
curl http://localhost:9001/health/ready
curl http://localhost:9001/metrics
```

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Disable tracing for testing
ENABLE_TRACING=false npm test

# Use console format for development
LOG_FORMAT=console npm run dev
```

## 🚀 **Production Deployment**

### Recommended Settings

```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_TRACING=true
OTEL_SAMPLE_RATE=0.1
LOG_TO_FILE=true
LOG_TO_CONSOLE=false
```

### Monitoring Stack

- **Jaeger** or **Zipkin** for trace visualization
- **Grafana** for metrics dashboards
- **ELK Stack** or **Fluentd** for log aggregation
- **Prometheus** for metrics collection
- **AlertManager** for incident response

## 📋 **Best Practices**

1. **Use correlation IDs** for request tracking
2. **Add business context** to all logs
3. **Create custom spans** for important operations
4. **Monitor performance thresholds**
5. **Track business events** for analytics
6. **Use structured logging** consistently
7. **Configure appropriate sampling** rates
8. **Set up automated alerts** for errors

## 🔍 **Troubleshooting**

### Common Issues

- **Missing trace context** - Check tracing initialization
- **High memory usage** - Adjust sampling rates
- **Log volume** - Review log levels and filters
- **Performance impact** - Monitor span creation overhead

### Debug Commands

```bash
# Check tracing status
curl http://localhost:9001/health | jq .tracing

# View recent errors
grep "ERROR" logs/review-service.log | tail -10

# Monitor performance
grep "performance" logs/review-service.log | jq .duration
```
