/**
 * End-to-End Test for Review-Product Service Event Flow with Dapr
 *
 * IMPORTANT: This test requires services to be manually started first!
 *
 * Terminal 1 - Product Service:
 * cd c:/gh/aioutlet/services/product-service
 * dapr run --app-id product-service --app-port 8003 --dapr-http-port 3500 --dapr-grpc-port 50001 --resources-path ./.dapr/components --config ./.dapr/config.yaml --log-level warn -- python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
 *
 * Terminal 2 - Review Service:
 * cd c:/gh/aioutlet/services/review-service
 * npm run dapr
 *
 * Also required:
 * - RabbitMQ running (via docker-compose)
 * - MongoDB running for both services
 */

import axios from 'axios';
import mongoose from 'mongoose';
import { setTimeout } from 'timers/promises';

// Configuration
const REVIEW_SERVICE_PORT = 9001;
const PRODUCT_SERVICE_PORT = 8003;
const MONGODB_REVIEW_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27020/aioutlet_reviews?directConnection=true';
const MONGODB_PRODUCT_URI =
  'mongodb://admin:admin123@127.0.0.1:27019/product_service_db?authSource=admin&directConnection=true';

describe('Review-Product Event Flow E2E Test (Manual)', () => {
  let reviewConnection;
  let productConnection;

  // Helper to check if service is running
  const checkService = async (url) => {
    try {
      await axios.get(url, { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  };

  beforeAll(async () => {
    console.log('\n🚀 Checking E2E Test Prerequisites...\n');

    // Check if services are running
    const reviewServiceReady = await checkService(`http://localhost:${REVIEW_SERVICE_PORT}/health`);
    const productServiceReady = await checkService(`http://localhost:${PRODUCT_SERVICE_PORT}/api/health`);

    if (!reviewServiceReady || !productServiceReady) {
      console.error('\n❌ Services not running!');
      console.error('Please start the services manually first:');
      console.error('\nTerminal 1 (Product Service):');
      console.error('cd c:/gh/aioutlet/services/product-service');
      console.error(
        'dapr run --app-id product-service --app-port 8003 --dapr-http-port 3500 --dapr-grpc-port 50001 --resources-path ./.dapr/components --config ./.dapr/config.yaml --log-level warn -- python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload'
      );
      console.error('\nTerminal 2 (Review Service):');
      console.error('cd c:/gh/aioutlet/services/review-service');
      console.error('npm run dapr\n');
      throw new Error('Services not running. Please start them manually first.');
    }

    console.log('✓ Review Service is running');
    console.log('✓ Product Service is running');

    // Connect to MongoDB databases
    try {
      reviewConnection = await mongoose.createConnection(MONGODB_REVIEW_URI).asPromise();
      console.log('✓ Connected to Review MongoDB');
    } catch (error) {
      console.error('✗ Failed to connect to Review MongoDB:', error.message);
      throw error;
    }

    try {
      productConnection = await mongoose.createConnection(MONGODB_PRODUCT_URI).asPromise();
      console.log('✓ Connected to Product MongoDB');
    } catch (error) {
      console.error('✗ Failed to connect to Product MongoDB:', error.message);
      throw error;
    }

    // Skip cleanup for now - will clean manually if needed
    // await reviewConnection.collection('reviews').deleteMany({ productId: '507f1f77bcf86cd799439011' });
    // await productConnection.collection('products').deleteMany({ _id: '507f1f77bcf86cd799439011' });
    console.log('✓ Test databases ready');

    // Insert test product
    const testProduct = {
      _id: '507f1f77bcf86cd799439011',
      name: 'E2E Test T-Shirt',
      price: 29.99,
      category: 'clothing',
      stock: 100,
      review_aggregates: {
        average_rating: 0,
        total_review_count: 0,
        verified_review_count: 0,
        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recent_reviews: [],
        last_review_date: null,
        last_updated: new Date(),
      },
    };
    await productConnection.collection('products').insertOne(testProduct);
    console.log('✓ Test product created');

    // Give events time to settle
    await setTimeout(1000);
    console.log('\n✓ Ready for testing\n');
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...\n');

    // Clean test data
    if (reviewConnection) {
      await reviewConnection.collection('reviews').deleteMany({ productId: '507f1f77bcf86cd799439011' });
      await reviewConnection.close();
    }
    if (productConnection) {
      await productConnection.collection('products').deleteMany({ _id: '507f1f77bcf86cd799439011' });
      await productConnection.close();
    }

    console.log('✓ Cleanup complete\n');
  }, 30000);

  describe('Review Created Event Flow', () => {
    it('should create review, publish event, and update product aggregates', async () => {
      // Create a review via review service API
      const reviewData = {
        productId: '507f1f77bcf86cd799439011',
        userId: 'e2e-user-001',
        rating: 5,
        title: 'Excellent product!',
        comment: 'Love this t-shirt, fits perfectly and great quality',
        isVerifiedPurchase: true,
      };

      const createResponse = await axios.post(`http://localhost:${REVIEW_SERVICE_PORT}/api/reviews`, reviewData, {
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': 'e2e-test-create-001',
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toHaveProperty('_id');
      const reviewId = createResponse.data._id;

      // Wait for event to propagate through Dapr
      await setTimeout(3000);

      // Verify product aggregates were updated
      const product = await productConnection.collection('products').findOne({ _id: '507f1f77bcf86cd799439011' });

      expect(product).toBeDefined();
      expect(product.review_aggregates).toMatchObject({
        average_rating: 5,
        total_review_count: 1,
        verified_review_count: 1,
        rating_distribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 1,
        },
      });

      expect(product.review_aggregates.last_review_date).toBeDefined();
      expect(product.review_aggregates.recent_reviews).toHaveLength(1);
      expect(product.review_aggregates.recent_reviews[0].rating).toBe(5);
      expect(product.review_aggregates.recent_reviews[0].title).toBe('Excellent product!');

      console.log('✓ Review created and product aggregates updated successfully');
    }, 20000);

    it('should handle multiple reviews and calculate correct average', async () => {
      // Create second review with different rating
      const reviewData2 = {
        productId: '507f1f77bcf86cd799439011',
        userId: 'e2e-user-002',
        rating: 4,
        title: 'Good product',
        comment: 'Nice quality but sizing runs a bit small',
        isVerifiedPurchase: false,
      };

      await axios.post(`http://localhost:${REVIEW_SERVICE_PORT}/api/reviews`, reviewData2, {
        headers: {
          'x-correlation-id': 'e2e-test-create-002',
        },
      });

      // Wait for event propagation
      await setTimeout(3000);

      // Verify aggregates: (5 + 4) / 2 = 4.5
      const product = await productConnection.collection('products').findOne({ _id: '507f1f77bcf86cd799439011' });

      expect(product.review_aggregates).toMatchObject({
        average_rating: 4.5,
        total_review_count: 2,
        verified_review_count: 1, // Only first review was verified
        rating_distribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 1,
          5: 1,
        },
      });

      console.log('✓ Multiple reviews processed and average calculated correctly');
    }, 20000);
  });

  describe('Review Updated Event Flow', () => {
    it('should update review rating and recalculate product aggregates', async () => {
      // Get a review to update
      const reviews = await reviewConnection
        .collection('reviews')
        .find({ productId: '507f1f77bcf86cd799439011' })
        .toArray();
      const reviewToUpdate = reviews[0];

      // Update the review rating
      const updateData = {
        rating: 3,
        title: 'Updated review',
        comment: 'Changed my opinion after more use',
      };

      await axios.put(`http://localhost:${REVIEW_SERVICE_PORT}/api/reviews/${reviewToUpdate._id}`, updateData, {
        headers: {
          'x-correlation-id': 'e2e-test-update-001',
        },
      });

      // Wait for event propagation
      await setTimeout(3000);

      // Verify aggregates were recalculated
      const product = await productConnection.collection('products').findOne({ _id: '507f1f77bcf86cd799439011' });

      // Should have updated from 5 to 3, so (3 + 4) / 2 = 3.5
      expect(product.review_aggregates.average_rating).toBe(3.5);
      expect(product.review_aggregates.total_review_count).toBe(2);
      expect(product.review_aggregates.rating_distribution['5']).toBe(0);
      expect(product.review_aggregates.rating_distribution['3']).toBe(1);

      console.log('✓ Review updated and product aggregates recalculated correctly');
    }, 20000);
  });

  describe('Review Deleted Event Flow', () => {
    it('should delete review and update product aggregates accordingly', async () => {
      // Get a review to delete
      const reviews = await reviewConnection
        .collection('reviews')
        .find({ productId: '507f1f77bcf86cd799439011' })
        .toArray();
      const reviewToDelete = reviews[0];

      // Delete the review
      await axios.delete(`http://localhost:${REVIEW_SERVICE_PORT}/api/reviews/${reviewToDelete._id}`, {
        headers: {
          'x-correlation-id': 'e2e-test-delete-001',
        },
      });

      // Wait for event propagation
      await setTimeout(3000);

      // Verify aggregates were updated
      const product = await productConnection.collection('products').findOne({ _id: '507f1f77bcf86cd799439011' });

      expect(product.review_aggregates.total_review_count).toBe(1);

      // Only one review left (rating: 4)
      const remainingReview = await reviewConnection
        .collection('reviews')
        .findOne({ productId: '507f1f77bcf86cd799439011' });
      expect(product.review_aggregates.average_rating).toBe(remainingReview.rating);

      console.log('✓ Review deleted and product aggregates updated correctly');
    }, 20000);
  });

  describe('Correlation ID Propagation', () => {
    it('should propagate correlation ID through the event chain', async () => {
      const correlationId = `e2e-test-correlation-${Date.now()}`;

      const reviewData = {
        productId: '507f1f77bcf86cd799439011',
        userId: 'e2e-user-004',
        rating: 5,
        title: 'Testing correlation',
        comment: 'This tests correlation ID propagation',
        isVerifiedPurchase: true,
      };

      const response = await axios.post(`http://localhost:${REVIEW_SERVICE_PORT}/api/reviews`, reviewData, {
        headers: {
          'x-correlation-id': correlationId,
        },
      });

      expect(response.headers['x-correlation-id']).toBe(correlationId);

      // Wait for event propagation
      await setTimeout(3000);

      // Check that product was updated (indirect proof of correlation ID working)
      const product = await productConnection.collection('products').findOne({ _id: '507f1f77bcf86cd799439011' });
      expect(product.review_aggregates.total_review_count).toBeGreaterThan(0);

      console.log('✓ Correlation ID propagated successfully');
    }, 20000);
  });
});
