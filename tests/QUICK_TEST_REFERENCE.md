# Quick Test Reference Card

## Run Tests

```bash
# Fast integration tests (mocked, ~5 seconds)
npm run test:integration

# Full E2E tests (real services, ~3 minutes)
npm run test:e2e

# All tests
npm test

# Watch mode
npm run test:watch
```

## Manual Testing Flow

### 1. Start Infrastructure

```bash
cd c:/gh/aioutlet/scripts/docker-compose
docker-compose up -d
```

### 2. Start Services

**Terminal 1 - Product Service:**

```bash
cd c:/gh/aioutlet/services/product-service
dapr run --app-id product-service --app-port 8003 --dapr-http-port 3500 --dapr-grpc-port 50001 --resources-path ./.dapr/components --config ./.dapr/config.yaml --log-level warn -- python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

**Terminal 2 - Review Service:**

```bash
cd c:/gh/aioutlet/services/review-service
npm run dapr
```

### 3. Test Commands

```bash
# Create product
curl -X POST http://localhost:8003/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Shirt","price":29.99,"category":"clothing","stock":100}'

# Create review (use product ID from above)
curl -X POST http://localhost:9001/api/reviews \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-001" \
  -d '{"productId":"PRODUCT_ID","userId":"user-123","rating":5,"title":"Great!","comment":"Love it","isVerifiedPurchase":true}'

# Get product with aggregates
curl http://localhost:8003/api/products/PRODUCT_ID

# Update review (use review ID from create response)
curl -X PUT http://localhost:9001/api/reviews/REVIEW_ID \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-002" \
  -d '{"rating":4,"title":"Updated","comment":"Still good"}'

# Delete review
curl -X DELETE http://localhost:9001/api/reviews/REVIEW_ID \
  -H "x-correlation-id: test-003"
```

## Expected Results

### After Create Review (rating: 5)

```json
{
  "review_aggregates": {
    "average_rating": 5,
    "total_review_count": 1,
    "verified_review_count": 1,
    "rating_distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 }
  }
}
```

### After Update Review (5 → 4)

```json
{
  "review_aggregates": {
    "average_rating": 4,
    "total_review_count": 1,
    "verified_review_count": 1,
    "rating_distribution": { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 }
  }
}
```

### After Delete Review

```json
{
  "review_aggregates": {
    "average_rating": 0,
    "total_review_count": 0,
    "verified_review_count": 0,
    "rating_distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  }
}
```

## Verify RabbitMQ

1. Open http://localhost:15672
2. Login: `guest` / `guest`
3. Check **Queues** tab - should see `review-service` queue
4. Check **Exchanges** tab - should see `review.created`, `review.updated`, `review.deleted`

## Troubleshooting

| Issue                    | Solution                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| Port already in use      | Kill process: `taskkill /F /PID <pid>` or `lsof -ti:PORT \| xargs kill` |
| Dapr not found           | Install: https://docs.dapr.io/getting-started/install-dapr-cli/         |
| MongoDB connection error | Check port in .env matches docker-compose.yml                           |
| Event not received       | Check Dapr logs, verify topic names match                               |
| Test timeout             | Increase jest.config.js timeout or check service logs                   |

## Event Topics

- `review.created` - New review added
- `review.updated` - Review rating/content changed
- `review.deleted` - Review removed

## Correlation IDs

Always include in requests for tracing:

```bash
-H "x-correlation-id: your-unique-id"
```

Format: `{operation}-{timestamp}` or `{feature}-{testcase}-{number}`
