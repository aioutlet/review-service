# Review Service

## Overview

The Review Service manages product reviews, ratings, and moderation for the AI Outlet platform. It provides comprehensive functionality for creating, managing, and analyzing product reviews with advanced features like helpfulness voting, content moderation, and real-time analytics.

## Features

- ⭐ Product rating and review system
- 🛡️ Automated content moderation
- 📊 Real-time analytics and aggregations
- 👍 Review helpfulness voting
- ✅ Verified purchase validation
- 🔍 Advanced filtering and sorting
- 📱 Media attachment support
- 🚀 Event-driven architecture

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis
- **Message Broker**: RabbitMQ
- **Testing**: Jest
- **Documentation**: JSDoc

## API Endpoints

### Public Endpoints

- `GET /api/v1/reviews/product/:productId` - Get product reviews
- `POST /api/v1/reviews` - Create review
- `PATCH /api/v1/reviews/:reviewId` - Update review
- `DELETE /api/v1/reviews/:reviewId` - Delete review
- `POST /api/v1/reviews/:reviewId/vote` - Vote on review helpfulness

### Admin Endpoints

- `GET /api/v1/moderation/reviews/pending` - Get pending reviews
- `PATCH /api/v1/moderation/reviews/:reviewId` - Moderate review
- `GET /api/v1/analytics/reviews/stats` - Get review statistics

### Internal Endpoints

- `GET /api/v1/internal/products/:productId/rating` - Get product rating
- `POST /api/v1/internal/reviews/bulk-update` - Bulk update reviews

### Operational Endpoints

- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /metrics` - Prometheus metrics

## Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=9001
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb://localhost:27017/aioutlet_reviews
REDIS_URL=redis://localhost:6379

# Message Broker
RABBITMQ_URL=amqp://localhost:5672

# Security
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:3000

# External Services
USER_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3002
ORDER_SERVICE_URL=http://localhost:3003

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Docker Support

```bash
# Build image
docker build -t review-service .

# Run container
docker run -p 9001:9001 --env-file .env review-service
```

## Message Events

### Published Events

- `review.created` - New review created
- `review.updated` - Review updated
- `review.deleted` - Review deleted
- `review.moderated` - Review moderated
- `product.rating.updated` - Product rating updated

### Consumed Events

- `order.completed` - Order completion for verified reviews
- `user.deleted` - User deletion for cleanup
- `product.deleted` - Product deletion for cleanup

## Development

### Code Style

- ES6+ modules
- Async/await for promises
- JSDoc for documentation
- ESLint for code quality

### Testing

- Unit tests with Jest
- Integration tests
- API endpoint testing with Supertest

### Monitoring

- Winston for logging
- Health checks for Kubernetes
- Correlation IDs for request tracing

## Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Follow semantic versioning

## License

MIT License - see LICENSE file for details
