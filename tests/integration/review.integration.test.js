import { jest } from '@jest/globals';

// Integration tests for Review Service workflows
describe('ReviewService Integration Tests', () => {
  
  describe('Review Creation Workflow', () => {
    
    it('should handle complete review creation flow', async () => {
      // Mock external dependencies
      const mockProductService = {
        validateProduct: jest.fn().mockResolvedValue(true),
      };
      
      const mockOrderService = {
        validatePurchase: jest.fn().mockResolvedValue(true),
      };
      
      const mockDatabase = {
        reviews: [],
        findExistingReview: jest.fn().mockResolvedValue(null),
        saveReview: jest.fn().mockImplementation((review) => {
          const savedReview = { 
            ...review, 
            _id: 'generated-id',
            metadata: { ...review.metadata, createdAt: new Date() }
          };
          mockDatabase.reviews.push(savedReview);
          return Promise.resolve(savedReview);
        }),
      };
      
      const mockEventBus = {
        events: [],
        publish: jest.fn().mockImplementation((event) => {
          mockEventBus.events.push(event);
          return Promise.resolve();
        }),
      };

      // Test data
      const reviewData = {
        productId: '507f1f77bcf86cd799439013',
        rating: 5,
        title: 'Excellent product!',
        comment: 'This product exceeded all my expectations. Highly recommended!',
        orderReference: 'ORD-12345',
      };
      
      const user = {
        userId: '507f1f77bcf86cd799439011',
        username: 'testuser',
      };

      // Simulate the review creation workflow
      const workflow = new ReviewCreationWorkflow({
        productService: mockProductService,
        orderService: mockOrderService,
        database: mockDatabase,
        eventBus: mockEventBus,
      });

      const result = await workflow.createReview(reviewData, user, 'correlation-123');

      // Assertions
      expect(mockDatabase.findExistingReview).toHaveBeenCalledWith({
        productId: reviewData.productId,
        userId: user.userId,
      });
      
      expect(mockProductService.validateProduct).toHaveBeenCalledWith(
        reviewData.productId,
        'correlation-123'
      );
      
      expect(mockOrderService.validatePurchase).toHaveBeenCalledWith(
        user.userId,
        reviewData.productId,
        reviewData.orderReference,
        'correlation-123'
      );
      
      expect(mockDatabase.saveReview).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review.created',
          data: expect.objectContaining({
            reviewId: 'generated-id',
            productId: reviewData.productId,
            userId: user.userId,
          }),
        })
      );
      
      expect(result).toHaveProperty('_id', 'generated-id');
      expect(result).toHaveProperty('isVerifiedPurchase', true);
      expect(result).toHaveProperty('status', 'approved');
    });

    it('should handle review creation with validation failures', async () => {
      const mockProductService = {
        validateProduct: jest.fn().mockRejectedValue(new Error('Product not found')),
      };
      
      const mockDatabase = {
        findExistingReview: jest.fn().mockResolvedValue(null),
      };

      const workflow = new ReviewCreationWorkflow({
        productService: mockProductService,
        database: mockDatabase,
      });

      const reviewData = {
        productId: 'invalid-product-id',
        rating: 5,
        title: 'Test',
        comment: 'Test comment',
      };
      
      const user = { userId: 'user123', username: 'testuser' };

      await expect(
        workflow.createReview(reviewData, user, 'correlation-123')
      ).rejects.toThrow('Product not found');
    });

    it('should prevent duplicate reviews', async () => {
      const existingReview = {
        _id: 'existing-review-id',
        productId: '507f1f77bcf86cd799439013',
        userId: '507f1f77bcf86cd799439011',
      };

      const mockDatabase = {
        findExistingReview: jest.fn().mockResolvedValue(existingReview),
      };

      const workflow = new ReviewCreationWorkflow({
        database: mockDatabase,
      });

      const reviewData = {
        productId: '507f1f77bcf86cd799439013',
        rating: 5,
        title: 'Another review',
        comment: 'This is a duplicate review attempt',
      };
      
      const user = {
        userId: '507f1f77bcf86cd799439011',
        username: 'testuser',
      };

      await expect(
        workflow.createReview(reviewData, user, 'correlation-123')
      ).rejects.toThrow('User has already reviewed this product');
    });
  });

  describe('Review Retrieval and Filtering Workflow', () => {
    
    it('should retrieve and filter reviews correctly', async () => {
      const mockReviews = [
        {
          _id: 'review1',
          productId: 'product123',
          rating: 5,
          status: 'approved',
          isVerifiedPurchase: true,
          helpfulVotes: { helpful: 10, notHelpful: 2 },
          metadata: { createdAt: new Date('2024-01-01') },
        },
        {
          _id: 'review2',
          productId: 'product123',
          rating: 4,
          status: 'approved',
          isVerifiedPurchase: false,
          helpfulVotes: { helpful: 5, notHelpful: 1 },
          metadata: { createdAt: new Date('2024-01-02') },
        },
        {
          _id: 'review3',
          productId: 'product123',
          rating: 3,
          status: 'pending',
          isVerifiedPurchase: true,
          helpfulVotes: { helpful: 2, notHelpful: 0 },
          metadata: { createdAt: new Date('2024-01-03') },
        },
      ];

      const mockDatabase = {
        findReviews: jest.fn().mockResolvedValue(mockReviews.filter(r => r.status === 'approved')),
        countReviews: jest.fn().mockResolvedValue(2),
      };

      const workflow = new ReviewRetrievalWorkflow({
        database: mockDatabase,
      });

      const options = {
        page: 1,
        limit: 10,
        status: 'approved',
        sortBy: 'helpfulness',
        sortOrder: 'desc',
      };

      const result = await workflow.getProductReviews('product123', options, 'correlation-123');

      expect(mockDatabase.findReviews).toHaveBeenCalledWith('product123', expect.objectContaining({
        status: 'approved',
        sortBy: 'helpfulness',
        sortOrder: 'desc',
        skip: 0,
        limit: 10,
      }));

      expect(result).toHaveProperty('reviews');
      expect(result).toHaveProperty('pagination');
      expect(result.reviews).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      
      // Check that reviews are enriched with computed fields
      expect(result.reviews[0]).toHaveProperty('helpfulScore');
      expect(result.reviews[0]).toHaveProperty('totalVotes');
      expect(result.reviews[0]).toHaveProperty('ageInDays');
    });

    it('should handle empty review results', async () => {
      const mockDatabase = {
        findReviews: jest.fn().mockResolvedValue([]),
        countReviews: jest.fn().mockResolvedValue(0),
      };

      const workflow = new ReviewRetrievalWorkflow({
        database: mockDatabase,
      });

      const result = await workflow.getProductReviews('nonexistent-product', {}, 'correlation-123');

      expect(result.reviews).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.pages).toBe(0);
    });
  });

  describe('Review Voting Workflow', () => {
    
    it('should handle vote submission correctly', async () => {
      const mockReview = {
        _id: 'review123',
        userId: 'author123',
        helpfulVotes: {
          helpful: 5,
          notHelpful: 2,
          userVotes: [
            { userId: 'user1', vote: 'helpful', votedAt: new Date() },
            { userId: 'user2', vote: 'notHelpful', votedAt: new Date() },
          ],
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockDatabase = {
        findReview: jest.fn().mockResolvedValue(mockReview),
      };

      const workflow = new ReviewVotingWorkflow({
        database: mockDatabase,
      });

      const result = await workflow.voteOnReview(
        'review123',
        'voter123',
        'helpful',
        'correlation-123'
      );

      expect(mockDatabase.findReview).toHaveBeenCalledWith('review123');
      expect(mockReview.helpfulVotes.helpful).toBe(6);
      expect(mockReview.helpfulVotes.userVotes).toHaveLength(3);
      expect(mockReview.save).toHaveBeenCalled();
    });

    it('should prevent voting on own review', async () => {
      const mockReview = {
        _id: 'review123',
        userId: 'author123',
        helpfulVotes: { helpful: 5, notHelpful: 2, userVotes: [] },
      };

      const mockDatabase = {
        findReview: jest.fn().mockResolvedValue(mockReview),
      };

      const workflow = new ReviewVotingWorkflow({
        database: mockDatabase,
      });

      await expect(
        workflow.voteOnReview('review123', 'author123', 'helpful', 'correlation-123')
      ).rejects.toThrow('You cannot vote on your own review');
    });

    it('should handle vote changes correctly', async () => {
      const mockReview = {
        _id: 'review123',
        userId: 'author123',
        helpfulVotes: {
          helpful: 5,
          notHelpful: 2,
          userVotes: [
            { userId: 'voter123', vote: 'helpful', votedAt: new Date() },
          ],
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockDatabase = {
        findReview: jest.fn().mockResolvedValue(mockReview),
      };

      const workflow = new ReviewVotingWorkflow({
        database: mockDatabase,
      });

      // Change vote from helpful to notHelpful
      await workflow.voteOnReview('review123', 'voter123', 'notHelpful', 'correlation-123');

      expect(mockReview.helpfulVotes.helpful).toBe(4);
      expect(mockReview.helpfulVotes.notHelpful).toBe(3);
      expect(mockReview.helpfulVotes.userVotes[0].vote).toBe('notHelpful');
    });
  });

  describe('Review Analytics Workflow', () => {
    
    it('should calculate review trends correctly', async () => {
      const mockTrendsData = {
        last7Days: [{ totalReviews: 15, averageRating: 4.2 }],
        last30Days: [{ totalReviews: 60, averageRating: 4.1 }],
      };

      const mockDatabase = {
        aggregateReviewTrends: jest.fn()
          .mockResolvedValueOnce(mockTrendsData.last7Days)
          .mockResolvedValueOnce(mockTrendsData.last30Days),
      };

      const workflow = new ReviewAnalyticsWorkflow({
        database: mockDatabase,
      });

      const result = await workflow.calculateReviewTrends('product123');

      expect(mockDatabase.aggregateReviewTrends).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        last7Days: {
          totalReviews: 15,
          averageRating: 4.2,
        },
        last30Days: {
          totalReviews: 60,
          averageRating: 4.1,
        },
      });
    });

    it('should handle products with no reviews', async () => {
      const mockDatabase = {
        aggregateReviewTrends: jest.fn().mockResolvedValue([]),
      };

      const workflow = new ReviewAnalyticsWorkflow({
        database: mockDatabase,
      });

      const result = await workflow.calculateReviewTrends('new-product');

      expect(result).toEqual({
        last7Days: {
          totalReviews: 0,
          averageRating: 0,
        },
        last30Days: {
          totalReviews: 0,
          averageRating: 0,
        },
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    it('should handle database connection failures gracefully', async () => {
      const mockDatabase = {
        findExistingReview: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      const workflow = new ReviewCreationWorkflow({
        database: mockDatabase,
      });

      const reviewData = {
        productId: '507f1f77bcf86cd799439013',
        rating: 5,
        title: 'Test',
        comment: 'Test comment',
      };
      
      const user = { userId: 'user123', username: 'testuser' };

      await expect(
        workflow.createReview(reviewData, user, 'correlation-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle external service timeouts', async () => {
      const mockProductService = {
        validateProduct: jest.fn().mockRejectedValue(new Error('Service timeout')),
      };

      const mockDatabase = {
        findExistingReview: jest.fn().mockResolvedValue(null),
        saveReview: jest.fn().mockImplementation((review) => {
          const savedReview = { 
            ...review, 
            _id: 'generated-id',
            metadata: { ...review.metadata, createdAt: new Date() }
          };
          return Promise.resolve(savedReview);
        }),
      };

      const workflow = new ReviewCreationWorkflow({
        productService: mockProductService,
        database: mockDatabase,
        gracefulDegradation: true,
      });

      const reviewData = {
        productId: '507f1f77bcf86cd799439013',
        rating: 5,
        title: 'Test',
        comment: 'Test comment',
      };
      
      const user = { userId: 'user123', username: 'testuser' };

      // Should continue despite external service failure
      const result = await workflow.createReview(reviewData, user, 'correlation-123');
      expect(result).toBeDefined();
    });
  });
});

// Mock workflow classes
class ReviewCreationWorkflow {
  constructor(dependencies) {
    this.productService = dependencies.productService;
    this.orderService = dependencies.orderService;
    this.database = dependencies.database;
    this.eventBus = dependencies.eventBus;
    this.gracefulDegradation = dependencies.gracefulDegradation || false;
  }

  async createReview(reviewData, user, correlationId) {
    // Check for existing review
    const existingReview = await this.database.findExistingReview({
      productId: reviewData.productId,
      userId: user.userId,
    });

    if (existingReview) {
      throw new Error('User has already reviewed this product');
    }

    // Validate product
    try {
      await this.productService.validateProduct(reviewData.productId, correlationId);
    } catch (error) {
      if (!this.gracefulDegradation) {
        throw error;
      }
    }

    // Validate purchase if order reference provided
    let isVerifiedPurchase = false;
    if (reviewData.orderReference && this.orderService) {
      try {
        isVerifiedPurchase = await this.orderService.validatePurchase(
          user.userId,
          reviewData.productId,
          reviewData.orderReference,
          correlationId
        );
      } catch (error) {
        // Graceful degradation - continue without verification
        isVerifiedPurchase = false;
      }
    }

    // Determine status
    const status = isVerifiedPurchase ? 'approved' : 'approved'; // Simplified logic

    // Create review
    const review = {
      ...reviewData,
      userId: user.userId,
      username: user.username,
      isVerifiedPurchase,
      status,
      helpfulVotes: { helpful: 0, notHelpful: 0, userVotes: [] },
      metadata: {
        source: 'web',
        createdAt: new Date(),
      },
    };

    const savedReview = await this.database.saveReview(review);

    // Publish event
    if (this.eventBus) {
      await this.eventBus.publish({
        type: 'review.created',
        data: {
          reviewId: savedReview._id,
          productId: savedReview.productId,
          userId: savedReview.userId,
          rating: savedReview.rating,
          status: savedReview.status,
          isVerifiedPurchase: savedReview.isVerifiedPurchase,
        },
        correlationId,
      });
    }

    return savedReview;
  }
}

class ReviewRetrievalWorkflow {
  constructor(dependencies) {
    this.database = dependencies.database;
  }

  async getProductReviews(productId, options = {}, correlationId) {
    const {
      page = 1,
      limit = 20,
      status = 'approved',
      sortBy = 'metadata.createdAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.database.findReviews(productId, {
        status,
        sortBy,
        sortOrder,
        skip,
        limit,
      }),
      this.database.countReviews(productId, { status }),
    ]);

    // Enrich reviews with computed fields
    const enrichedReviews = reviews.map(review => ({
      ...review,
      helpfulScore: this.calculateHelpfulScore(review.helpfulVotes),
      totalVotes: review.helpfulVotes.helpful + review.helpfulVotes.notHelpful,
      ageInDays: Math.floor((Date.now() - new Date(review.metadata.createdAt)) / (1000 * 60 * 60 * 24)),
    }));

    return {
      reviews: enrichedReviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  calculateHelpfulScore(helpfulVotes) {
    const total = helpfulVotes.helpful + helpfulVotes.notHelpful;
    return total > 0 ? Math.round((helpfulVotes.helpful / total) * 100) : 0;
  }
}

class ReviewVotingWorkflow {
  constructor(dependencies) {
    this.database = dependencies.database;
  }

  async voteOnReview(reviewId, userId, vote, correlationId) {
    if (!['helpful', 'notHelpful'].includes(vote)) {
      throw new Error('Vote must be either "helpful" or "notHelpful"');
    }

    const review = await this.database.findReview(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    if (review.userId === userId) {
      throw new Error('You cannot vote on your own review');
    }

    // Process vote
    const existingVoteIndex = review.helpfulVotes.userVotes.findIndex(v => v.userId === userId);

    if (existingVoteIndex >= 0) {
      const oldVote = review.helpfulVotes.userVotes[existingVoteIndex].vote;
      if (oldVote === vote) {
        // Remove vote
        review.helpfulVotes.userVotes.splice(existingVoteIndex, 1);
        review.helpfulVotes[oldVote]--;
      } else {
        // Change vote
        review.helpfulVotes.userVotes[existingVoteIndex].vote = vote;
        review.helpfulVotes.userVotes[existingVoteIndex].votedAt = new Date();
        review.helpfulVotes[oldVote]--;
        review.helpfulVotes[vote]++;
      }
    } else {
      // Add new vote
      review.helpfulVotes.userVotes.push({
        userId,
        vote,
        votedAt: new Date(),
      });
      review.helpfulVotes[vote]++;
    }

    await review.save();
    return review;
  }
}

class ReviewAnalyticsWorkflow {
  constructor(dependencies) {
    this.database = dependencies.database;
  }

  async calculateReviewTrends(productId) {
    const [trends7, trends30] = await Promise.all([
      this.database.aggregateReviewTrends(productId, 7),
      this.database.aggregateReviewTrends(productId, 30),
    ]);

    return {
      last7Days: {
        totalReviews: trends7[0]?.totalReviews || 0,
        averageRating: trends7[0]?.averageRating ? Math.round(trends7[0].averageRating * 10) / 10 : 0,
      },
      last30Days: {
        totalReviews: trends30[0]?.totalReviews || 0,
        averageRating: trends30[0]?.averageRating ? Math.round(trends30[0].averageRating * 10) / 10 : 0,
      },
    };
  }
}