# Review-Product Service Integration Testing Guide

This guide covers testing the event-driven integration between Review Service and Product Service via Dapr pub/sub.

## Test Types

### 1. Integration Tests (Fast, Mocked)

**Location:** `tests/integration/dapr-events.integration.test.js`

Tests event publishing logic with mocked Dapr client. No infrastructure required.

**Run:**

```bash
cd services/review-service
npm test -- tests/integration/dapr-events.integration.test.js
```

**Coverage:**

- ✅ CloudEvents schema validation
- ✅ Event payload structure
- ✅ Correlation ID propagation
- ✅ previousRating in update events
- ✅ Error handling
- ✅ Product service consumer expectations

**Duration:** ~5 seconds

---

### 2. End-to-End Tests (Real Services)

**Location:** `tests/e2e/dapr-event-flow.e2e.test.js`

Tests complete event flow with actual Dapr sidecars and services running.

**Prerequisites:**

```bash
# 1. Install Dapr CLI
# https://docs.dapr.io/getting-started/install-dapr-cli/

# 2. Start infrastructure
cd scripts/docker-compose
docker-compose up -d

# 3. Verify services are running
docker ps
# Should see: MongoDB (ports 27017, 27020), RabbitMQ (5672, 15672)
```

**Run:**

```bash
cd services/review-service
npm run test:e2e
```

Or with specific test:

```bash
npm test -- tests/e2e/dapr-event-flow.e2e.test.js
```

**What It Tests:**

- ✅ Review created → Event published → Product aggregates updated
- ✅ Multiple reviews → Correct average calculation
- ✅ Review updated → previousRating used → Aggregates recalculated
- ✅ Review deleted → Aggregates adjusted
- ✅ Correlation ID propagation through services
- ✅ Error scenarios (non-existent product)

**Duration:** ~2-3 minutes

---

## Test Flow Diagram

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Review Service │         │     Dapr     │         │ Product Service │
│   (Node.js)     │         │   Pub/Sub    │         │    (Python)     │
└────────┬────────┘         └──────┬───────┘         └────────┬────────┘
         │                         │                          │
         │ 1. POST /api/reviews    │                          │
         │────────────────────────>│                          │
         │                         │                          │
         │ 2. Publish Event        │                          │
         │ (review.created)        │                          │
         │────────────────────────>│                          │
         │                         │                          │
         │                         │ 3. Subscribe & Deliver   │
         │                         │─────────────────────────>│
         │                         │                          │
         │                         │ 4. Update Aggregates     │
         │                         │<─────────────────────────│
         │                         │                          │
         │ 5. Response             │                          │
         │<────────────────────────│                          │
```

---

## Event Schema Validation

### Review Created Event

```json
{
  "specversion": "1.0",
  "type": "review.created",
  "source": "review-service",
  "id": "correlation-id-timestamp",
  "time": "2025-11-06T10:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "reviewId": "review-12345",
    "productId": "507f1f77bcf86cd799439011",
    "userId": "user-67890",
    "rating": 5,
    "title": "Excellent product!",
    "comment": "Love this t-shirt",
    "verified": true,
    "createdAt": "2025-11-06T10:00:00Z",
    "timestamp": 1730890800000,
    "metadata": {
      "eventVersion": "1.0",
      "retryCount": 0,
      "source": "review-service",
      "environment": "development"
    }
  }
}
```

### Review Updated Event

```json
{
  "type": "review.updated",
  "data": {
    "reviewId": "review-12345",
    "productId": "507f1f77bcf86cd799439011",
    "userId": "user-67890",
    "rating": 4,
    "previousRating": 5, // ← Required for recalculation
    "title": "Updated review",
    "comment": "Changed my opinion",
    "verified": true,
    "updatedAt": "2025-11-06T11:00:00Z"
  }
}
```

### Review Deleted Event

```json
{
  "type": "review.deleted",
  "data": {
    "reviewId": "review-12345",
    "productId": "507f1f77bcf86cd799439011",
    "userId": "user-67890",
    "rating": 5, // ← Required for aggregate adjustment
    "verified": true, // ← Required for verified count
    "deletedAt": "2025-11-06T12:00:00Z"
  }
}
```

---

## Running Manual Integration Tests

### Step 1: Start Infrastructure

```bash
cd c:/gh/aioutlet
npm run task start-infrastructure
# or
cd scripts/docker-compose
docker-compose up -d
```

### Step 2: Start Product Service with Dapr

```bash
cd services/product-service

# Terminal 1: Start with Dapr
dapr run \
  --app-id product-service \
  --app-port 8003 \
  --dapr-http-port 3500 \
  --dapr-grpc-port 50001 \
  --resources-path ./.dapr/components \
  --config ./.dapr/config.yaml \
  --log-level warn \
  -- python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

### Step 3: Start Review Service with Dapr

```bash
cd services/review-service

# Terminal 2: Start with Dapr
npm run dapr
# or
dapr run \
  --app-id review-service \
  --app-port 9001 \
  --dapr-http-port 3501 \
  --dapr-grpc-port 50002 \
  --resources-path ./.dapr/components \
  --config ./.dapr/config.yaml \
  --log-level warn \
  -- npm run dev
```

### Step 4: Test the Flow

#### Create a product (Product Service)

```bash
curl -X POST http://localhost:8003/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test T-Shirt",
    "description": "A comfortable cotton t-shirt",
    "price": 29.99,
    "category": "clothing",
    "stock": 100
  }'
```

Response: Note the `id` field (e.g., `507f1f77bcf86cd799439011`)

#### Create a review (Review Service)

```bash
curl -X POST http://localhost:9001/api/reviews \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-test-001" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "userId": "user-123",
    "rating": 5,
    "title": "Excellent quality!",
    "comment": "Love this t-shirt, fits perfectly",
    "isVerifiedPurchase": true
  }'
```

#### Verify product aggregates updated

```bash
curl http://localhost:8003/api/products/507f1f77bcf86cd799439011
```

Expected response should include:

```json
{
  "review_aggregates": {
    "average_rating": 5,
    "total_review_count": 1,
    "verified_review_count": 1,
    "rating_distribution": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 1
    }
  }
}
```

#### Update the review

```bash
curl -X PUT http://localhost:9001/api/reviews/{reviewId} \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-test-002" \
  -d '{
    "rating": 4,
    "title": "Updated review",
    "comment": "Still good but not perfect"
  }'
```

#### Verify aggregates recalculated

```bash
curl http://localhost:8003/api/products/507f1f77bcf86cd799439011
```

Expected: `average_rating: 4`, `rating_distribution.5: 0`, `rating_distribution.4: 1`

#### Delete the review

```bash
curl -X DELETE http://localhost:9001/api/reviews/{reviewId} \
  -H "x-correlation-id: manual-test-003"
```

#### Verify aggregates reset

```bash
curl http://localhost:8003/api/products/507f1f77bcf86cd799439011
```

Expected: `average_rating: 0`, `total_review_count: 0`

---

## Troubleshooting

### E2E Tests Failing

**Issue:** Services not starting

- Check if ports are available (9001, 8003, 3500, 3501)
- Verify Dapr CLI is installed: `dapr --version`
- Check MongoDB is running: `docker ps | grep mongo`
- Check RabbitMQ is running: `docker ps | grep rabbitmq`

**Issue:** Events not propagating

- Check Dapr logs: Look for "subscribed to topic" messages
- Verify RabbitMQ queues: http://localhost:15672 (guest/guest)
- Check Dapr components: `.dapr/components/pubsub.yaml` exists
- Verify topic names match: `review.created`, `review.updated`, `review.deleted`

**Issue:** Timeout errors

- Increase timeout in test (currently 20s per test, 120s for setup)
- Check service logs for errors
- Verify network connectivity between services

### Integration Tests Failing

**Issue:** Mock not working

- Ensure `@dapr/dapr` is properly mocked
- Check jest.config.js for correct transform settings
- Clear jest cache: `npm test -- --clearCache`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
          - 27020:27020

      rabbitmq:
        image: rabbitmq:3-management
        ports:
          - 5672:5672
          - 15672:15672

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install Dapr CLI
        run: |
          wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash
          dapr init --slim

      - name: Install dependencies
        run: |
          cd services/review-service && npm install
          cd services/product-service && pip install -r requirements.txt

      - name: Run integration tests
        run: |
          cd services/review-service
          npm test -- tests/integration/dapr-events.integration.test.js

      - name: Run E2E tests
        run: |
          cd services/review-service
          npm run test:e2e
```

---

## Performance Benchmarks

| Test Type   | Duration | Services Started    | Infrastructure Required |
| ----------- | -------- | ------------------- | ----------------------- |
| Integration | ~5s      | None (mocked)       | None                    |
| E2E         | ~2-3min  | 2 (Review, Product) | MongoDB, RabbitMQ, Dapr |

---

## Related Documentation

- [Dapr Pub/Sub Documentation](https://docs.dapr.io/developing-applications/building-blocks/pubsub/)
- [CloudEvents Specification](https://cloudevents.io/)
- [Review Service README](../../README.md)
- [Product Service README](../../../product-service/README.md)
