#!/bin/bash

# Manual Integration Test Script
# Tests the Review-Product event flow through Dapr

echo "🧪 Manual Integration Test - Review to Product Event Flow"
echo "==========================================================="
echo ""

REVIEW_SERVICE="http://localhost:9001"
PRODUCT_SERVICE="http://localhost:8003"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test product ID
PRODUCT_ID="507f1f77bcf86cd799439011"

echo -e "${BLUE}Step 1: Create a test product${NC}"
curl -X POST "${PRODUCT_SERVICE}/api/products" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integration Test T-Shirt",
    "description": "Test product for event integration",
    "price": 29.99,
    "category": "clothing",
    "stock": 100
  }' | jq '.'

echo ""
PRODUCT_ID=$(curl -s -X POST "${PRODUCT_SERVICE}/api/products" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integration Test T-Shirt",
    "description": "Test product for event integration",
    "price": 29.99,
    "category": "clothing",
    "stock": 100
  }' | jq -r '.id // empty')

if [ -n "$PRODUCT_ID" ]; then
  echo -e "${GREEN}✓ Product created with ID: ${PRODUCT_ID}${NC}"
else
  PRODUCT_ID="507f1f77bcf86cd799439011"
  echo -e "${BLUE}Using default product ID: ${PRODUCT_ID}${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Check initial product aggregates${NC}"
curl -s "${PRODUCT_SERVICE}/api/products/${PRODUCT_ID}" | jq '.review_aggregates'

echo ""
echo -e "${BLUE}Step 3: Create a review (Rating: 5)${NC}"
echo "Note: If this returns 401, you need to add authentication token"
curl -X POST "${REVIEW_SERVICE}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-test-001" \
  -d "{
    \"productId\": \"${PRODUCT_ID}\",
    \"userId\": \"manual-test-user-001\",
    \"rating\": 5,
    \"title\": \"Excellent product!\",
    \"comment\": \"Love this t-shirt, great quality\",
    \"isVerifiedPurchase\": true
  }" | jq '.'

REVIEW_ID=$(curl -s -X POST "${REVIEW_SERVICE}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-test-001" \
  -d "{
    \"productId\": \"${PRODUCT_ID}\",
    \"userId\": \"manual-test-user-001\",
    \"rating\": 5,
    \"title\": \"Excellent product!\",
    \"comment\": \"Love this t-shirt, great quality\",
    \"isVerifiedPurchase\": true
  }" | jq -r '._id // .reviewId // empty')

echo ""
echo -e "${BLUE}Waiting 3 seconds for event propagation...${NC}"
sleep 3

echo ""
echo -e "${BLUE}Step 4: Verify product aggregates updated${NC}"
AGGREGATES=$(curl -s "${PRODUCT_SERVICE}/api/products/${PRODUCT_ID}" | jq '.review_aggregates')
echo "$AGGREGATES"

AVG_RATING=$(echo "$AGGREGATES" | jq -r '.average_rating')
TOTAL_COUNT=$(echo "$AGGREGATES" | jq -r '.total_review_count')

if [ "$AVG_RATING" = "5" ] && [ "$TOTAL_COUNT" = "1" ]; then
  echo -e "${GREEN}✓ SUCCESS: Product aggregates updated correctly!${NC}"
  echo -e "${GREEN}  Average Rating: ${AVG_RATING}${NC}"
  echo -e "${GREEN}  Total Reviews: ${TOTAL_COUNT}${NC}"
else
  echo -e "${RED}✗ FAIL: Product aggregates not updated as expected${NC}"
  echo -e "${RED}  Expected: average_rating=5, total_review_count=1${NC}"
  echo -e "${RED}  Actual: average_rating=${AVG_RATING}, total_review_count=${TOTAL_COUNT}${NC}"
fi

echo ""
echo -e "${BLUE}Step 5: Create second review (Rating: 4)${NC}"
curl -s -X POST "${REVIEW_SERVICE}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-test-002" \
  -d "{
    \"productId\": \"${PRODUCT_ID}\",
    \"userId\": \"manual-test-user-002\",
    \"rating\": 4,
    \"title\": \"Good product\",
    \"comment\": \"Nice quality\",
    \"isVerifiedPurchase\": false
  }" > /dev/null

echo "Waiting 3 seconds for event propagation..."
sleep 3

echo ""
echo -e "${BLUE}Step 6: Verify average calculation (should be 4.5)${NC}"
AGGREGATES=$(curl -s "${PRODUCT_SERVICE}/api/products/${PRODUCT_ID}" | jq '.review_aggregates')
echo "$AGGREGATES"

AVG_RATING=$(echo "$AGGREGATES" | jq -r '.average_rating')
TOTAL_COUNT=$(echo "$AGGREGATES" | jq -r '.total_review_count')

if [ "$AVG_RATING" = "4.5" ] && [ "$TOTAL_COUNT" = "2" ]; then
  echo -e "${GREEN}✓ SUCCESS: Average calculated correctly! (5+4)/2 = 4.5${NC}"
else
  echo -e "${RED}✗ FAIL: Average not calculated correctly${NC}"
  echo -e "${RED}  Expected: average_rating=4.5, total_review_count=2${NC}"
  echo -e "${RED}  Actual: average_rating=${AVG_RATING}, total_review_count=${TOTAL_COUNT}${NC}"
fi

echo ""
echo "==========================================================="
echo -e "${BLUE}✅ Integration test complete!${NC}"
echo ""
echo "Summary:"
echo "- Review Service publishes events via Dapr"
echo "- Product Service consumes events via Dapr"
echo "- Review aggregates are updated automatically"
echo ""
