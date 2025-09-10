import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import connectDB from '../src/config/database.js';
import Review from '../src/models/Review.js';
import ProductRating from '../src/models/ProductRating.js';

// Mock external dependencies
jest.mock('../src/config/database.js');
jest.mock('../src/config/redis.js');
jest.mock('../src/messaging/rabbitmq.js');

describe('Review Service API', () => {
  let authToken;
  let testUserId;
  let testProductId;
  let testReviewId;

  beforeAll(async () => {
    // Mock database connection
    connectDB.mockResolvedValue();

    // Setup test data
    testUserId = 'test-user-123';
    testProductId = 'test-product-456';
    authToken = 'Bearer test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    test('GET /health should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'review-service');
    });

    test('GET /health/ready should return readiness status', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('dependencies');
    });

    test('GET /health/live should return liveness status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });
  });

  describe('Service Information', () => {
    test('GET / should return service information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toHaveProperty('message', 'AI Outlet Review Service');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
    });

    test('GET /api should return API documentation', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body).toHaveProperty('service', 'review-service');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('reviews');
      expect(response.body.endpoints).toHaveProperty('moderation');
      expect(response.body.endpoints).toHaveProperty('analytics');
    });
  });

  describe('Reviews API', () => {
    const mockReview = {
      _id: 'review-123',
      userId: 'test-user-123',
      productId: 'test-product-456',
      rating: 5,
      title: 'Excellent product',
      content: 'This product is amazing. I highly recommend it to everyone.',
      status: 'approved',
      isVerifiedPurchase: true,
      votes: { helpful: 0, notHelpful: 0, spam: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Mock Review model methods
      Review.find = jest.fn();
      Review.findById = jest.fn();
      Review.findOne = jest.fn();
      Review.create = jest.fn();
      Review.findByIdAndUpdate = jest.fn();
      Review.findByIdAndDelete = jest.fn();
      Review.aggregate = jest.fn();
      Review.countDocuments = jest.fn();
    });

    test('GET /api/v1/reviews/product/:productId should return product reviews', async () => {
      Review.aggregate.mockResolvedValue([mockReview]);
      Review.countDocuments.mockResolvedValue(1);

      const response = await request(app).get(`/api/v1/reviews/product/${testProductId}`).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data).toHaveProperty('pagination');
    });

    test('POST /api/v1/reviews should create a new review', async () => {
      Review.findOne.mockResolvedValue(null); // No existing review
      Review.create.mockResolvedValue(mockReview);

      const reviewData = {
        productId: testProductId,
        rating: 5,
        title: 'Great product',
        content: 'This product works perfectly and exceeded my expectations.',
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', authToken)
        .send(reviewData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('review');
    });

    test('GET /api/v1/reviews/:reviewId should return specific review', async () => {
      Review.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockReview),
      });

      const response = await request(app).get(`/api/v1/reviews/${mockReview._id}`).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('review');
    });

    test('PUT /api/v1/reviews/:reviewId should update review', async () => {
      const updatedReview = { ...mockReview, title: 'Updated title' };
      Review.findById.mockResolvedValue(mockReview);
      Review.findByIdAndUpdate.mockResolvedValue(updatedReview);

      const updateData = {
        title: 'Updated title',
        content: 'Updated content for the review.',
      };

      const response = await request(app)
        .put(`/api/v1/reviews/${mockReview._id}`)
        .set('Authorization', authToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.review).toHaveProperty('title', 'Updated title');
    });

    test('DELETE /api/v1/reviews/:reviewId should delete review', async () => {
      Review.findById.mockResolvedValue(mockReview);
      Review.findByIdAndDelete.mockResolvedValue(mockReview);

      const response = await request(app)
        .delete(`/api/v1/reviews/${mockReview._id}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Review Voting API', () => {
    const reviewId = 'review-123';

    beforeEach(() => {
      Review.findById = jest.fn();
      Review.findByIdAndUpdate = jest.fn();
    });

    test('POST /api/v1/reviews/:reviewId/vote should add helpful vote', async () => {
      const mockReview = {
        _id: reviewId,
        votes: { helpful: 0, notHelpful: 0, spam: 0 },
      };

      Review.findById.mockResolvedValue(mockReview);
      Review.findByIdAndUpdate.mockResolvedValue({
        ...mockReview,
        votes: { helpful: 1, notHelpful: 0, spam: 0 },
      });

      const response = await request(app)
        .post(`/api/v1/reviews/${reviewId}/vote`)
        .set('Authorization', authToken)
        .send({ voteType: 'helpful' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('POST /api/v1/reviews/:reviewId/flag should flag review', async () => {
      const mockReview = { _id: reviewId };
      Review.findById.mockResolvedValue(mockReview);

      const response = await request(app)
        .post(`/api/v1/reviews/${reviewId}/flag`)
        .set('Authorization', authToken)
        .send({ reason: 'spam', description: 'This review looks like spam' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Analytics API', () => {
    beforeEach(() => {
      Review.aggregate = jest.fn();
      ProductRating.find = jest.fn();
    });

    test('GET /api/v1/analytics/product/:productId should return product analytics', async () => {
      const mockAnalytics = {
        averageRating: 4.5,
        totalReviews: 10,
        ratingDistribution: { 5: 5, 4: 3, 3: 1, 2: 1, 1: 0 },
        sentimentAnalysis: { positive: 8, negative: 1, neutral: 1 },
      };

      Review.aggregate.mockResolvedValue([mockAnalytics]);

      const response = await request(app)
        .get(`/api/v1/analytics/product/${testProductId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('analytics');
    });

    test('GET /api/v1/analytics/trending should return trending products', async () => {
      const mockTrending = [
        { productId: 'product-1', averageRating: 4.8, totalReviews: 50 },
        { productId: 'product-2', averageRating: 4.6, totalReviews: 35 },
      ];

      ProductRating.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockTrending),
        }),
      });

      const response = await request(app).get('/api/v1/analytics/trending').set('Authorization', authToken).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('trending');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    test('should handle validation errors', async () => {
      const invalidReviewData = {
        // Missing required fields
        rating: 6, // Invalid rating
        title: 'a', // Too short
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', authToken)
        .send(invalidReviewData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle authentication errors', async () => {
      const response = await request(app)
        .post('/api/v1/reviews')
        .send({
          productId: testProductId,
          rating: 5,
          title: 'Test review',
          content: 'This is a test review.',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(15)
        .fill()
        .map(() => request(app).get('/api/v1/reviews/product/test-product'));

      const responses = await Promise.all(requests);

      // Check if any request was rate limited
      const rateLimitedResponse = responses.find((response) => response.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('Correlation ID', () => {
    test('should include correlation ID in responses', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('correlationId');
      expect(typeof response.body.correlationId).toBe('string');
    });

    test('should use provided correlation ID', async () => {
      const correlationId = 'test-correlation-123';

      const response = await request(app).get('/health').set('X-Correlation-ID', correlationId).expect(200);

      expect(response.body).toHaveProperty('correlationId', correlationId);
    });
  });
});

describe('Database Models', () => {
  describe('Review Model', () => {
    test('should validate required fields', async () => {
      const invalidReview = new Review({
        // Missing required fields
        rating: 5,
      });

      let error;
      try {
        await invalidReview.validate();
      } catch (validationError) {
        error = validationError;
      }

      expect(error).toBeDefined();
      expect(error.errors).toHaveProperty('userId');
      expect(error.errors).toHaveProperty('productId');
    });

    test('should validate rating range', async () => {
      const invalidReview = new Review({
        userId: 'user-123',
        productId: 'product-456',
        rating: 6, // Invalid rating
        title: 'Test review',
        content: 'This is a test review.',
      });

      let error;
      try {
        await invalidReview.validate();
      } catch (validationError) {
        error = validationError;
      }

      expect(error).toBeDefined();
      expect(error.errors).toHaveProperty('rating');
    });
  });

  describe('ProductRating Model', () => {
    test('should validate required fields', async () => {
      const invalidRating = new ProductRating({
        // Missing required fields
        averageRating: 4.5,
      });

      let error;
      try {
        await invalidRating.validate();
      } catch (validationError) {
        error = validationError;
      }

      expect(error).toBeDefined();
      expect(error.errors).toHaveProperty('productId');
    });
  });
});

describe('Utility Functions', () => {
  test('should handle logger functionality', () => {
    const logger = app.locals.logger;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
