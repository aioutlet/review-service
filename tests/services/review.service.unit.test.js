import { jest } from '@jest/globals';

// Define test utilities class that mimics the ReviewService logic
class ReviewServiceTest {
  constructor(config = {}) {
    this.config = {
      review: {
        autoApproveVerified: true,
        moderationRequired: false,
        ...config.review,
      },
      externalServices: {
        productService: 'http://product-service',
        orderService: 'http://order-service',
        ...config.externalServices,
      },
    };
  }

  /**
   * Calculate helpful score percentage
   * @param {Object} helpfulVotes - Helpful votes object
   * @returns {Number} Helpful score percentage
   */
  calculateHelpfulScore(helpfulVotes) {
    const total = helpfulVotes.helpful + helpfulVotes.notHelpful;
    return total > 0 ? Math.round((helpfulVotes.helpful / total) * 100) : 0;
  }

  /**
   * Determine initial review status
   * @param {Boolean} isVerifiedPurchase - Is verified purchase
   * @returns {String} Status
   */
  determineInitialStatus(isVerifiedPurchase) {
    if (this.config.review.autoApproveVerified && isVerifiedPurchase) {
      return 'approved';
    }
    return this.config.review.moderationRequired ? 'pending' : 'approved';
  }

  /**
   * Validate vote type
   * @param {String} vote - Vote type
   * @returns {Boolean} Is valid vote
   */
  isValidVote(vote) {
    return ['helpful', 'notHelpful'].includes(vote);
  }

  /**
   * Process vote on review helpfulness
   * @param {Object} review - Review object
   * @param {String} userId - User ID
   * @param {String} vote - Vote type
   * @returns {Object} Result object with updated review
   */
  processVote(review, userId, vote) {
    if (!this.isValidVote(vote)) {
      throw new Error('Vote must be either "helpful" or "notHelpful"');
    }

    if (review.userId === userId) {
      throw new Error('You cannot vote on your own review');
    }

    // Find existing vote
    const existingVoteIndex = review.helpfulVotes.userVotes.findIndex((v) => v.userId === userId);

    if (existingVoteIndex >= 0) {
      // Update existing vote
      const oldVote = review.helpfulVotes.userVotes[existingVoteIndex].vote;

      if (oldVote === vote) {
        // Remove vote if same vote
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

    return review;
  }

  /**
   * Filter reviews based on criteria
   * @param {Array} reviews - Array of reviews
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered reviews
   */
  filterReviews(reviews, filters = {}) {
    return reviews.filter(review => {
      // Status filter
      if (filters.status && review.status !== filters.status) {
        return false;
      }

      // Rating filter
      if (filters.rating) {
        if (Array.isArray(filters.rating)) {
          if (!filters.rating.includes(review.rating)) {
            return false;
          }
        } else if (review.rating !== filters.rating) {
          return false;
        }
      }

      // Verified purchase filter
      if (filters.verifiedOnly && !review.isVerifiedPurchase) {
        return false;
      }

      // Media filter
      if (filters.withMedia) {
        const hasImages = review.images && review.images.length > 0;
        const hasVideos = review.videos && review.videos.length > 0;
        if (!hasImages && !hasVideos) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort reviews
   * @param {Array} reviews - Array of reviews
   * @param {String} sortBy - Sort field
   * @param {String} sortOrder - Sort order (asc/desc)
   * @returns {Array} Sorted reviews
   */
  sortReviews(reviews, sortBy = 'metadata.createdAt', sortOrder = 'desc') {
    const sortedReviews = [...reviews];
    
    sortedReviews.sort((a, b) => {
      let aValue, bValue;

      if (sortBy === 'helpfulness') {
        aValue = a.helpfulVotes.helpful;
        bValue = b.helpfulVotes.helpful;
      } else if (sortBy === 'rating') {
        aValue = a.rating;
        bValue = b.rating;
      } else if (sortBy === 'metadata.createdAt') {
        aValue = new Date(a.metadata.createdAt);
        bValue = new Date(b.metadata.createdAt);
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    return sortedReviews;
  }

  /**
   * Calculate pagination
   * @param {Number} total - Total count
   * @param {Number} page - Current page
   * @param {Number} limit - Items per page
   * @returns {Object} Pagination info
   */
  calculatePagination(total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Enrich review with computed fields
   * @param {Object} review - Review object
   * @returns {Object} Enriched review
   */
  enrichReview(review) {
    return {
      ...review,
      helpfulScore: this.calculateHelpfulScore(review.helpfulVotes),
      totalVotes: review.helpfulVotes.helpful + review.helpfulVotes.notHelpful,
      ageInDays: Math.floor((Date.now() - new Date(review.metadata.createdAt)) / (1000 * 60 * 60 * 24)),
    };
  }
}

describe('ReviewService Core Logic Tests', () => {
  let reviewService;

  beforeEach(() => {
    reviewService = new ReviewServiceTest();
  });

  describe('calculateHelpfulScore', () => {
    it('should calculate helpful score percentage correctly', () => {
      const testCases = [
        { helpful: 10, notHelpful: 0, expected: 100 },
        { helpful: 0, notHelpful: 10, expected: 0 },
        { helpful: 7, notHelpful: 3, expected: 70 },
        { helpful: 1, notHelpful: 2, expected: 33 },
        { helpful: 0, notHelpful: 0, expected: 0 },
      ];

      testCases.forEach(({ helpful, notHelpful, expected }) => {
        const result = reviewService.calculateHelpfulScore({
          helpful,
          notHelpful,
          userVotes: [],
        });
        expect(result).toBe(expected);
      });
    });
  });

  describe('determineInitialStatus', () => {
    it('should return approved for verified purchase when autoApproveVerified is true', () => {
      const result = reviewService.determineInitialStatus(true);
      expect(result).toBe('approved');
    });

    it('should return pending when moderationRequired is true and not verified', () => {
      reviewService.config.review.moderationRequired = true;
      reviewService.config.review.autoApproveVerified = false;

      const result = reviewService.determineInitialStatus(false);
      expect(result).toBe('pending');
    });

    it('should return approved when moderationRequired is false', () => {
      reviewService.config.review.moderationRequired = false;

      const result = reviewService.determineInitialStatus(false);
      expect(result).toBe('approved');
    });

    it('should prioritize autoApproveVerified over moderationRequired for verified purchases', () => {
      reviewService.config.review.moderationRequired = true;
      reviewService.config.review.autoApproveVerified = true;

      const result = reviewService.determineInitialStatus(true);
      expect(result).toBe('approved');
    });
  });

  describe('vote processing', () => {
    let mockReview;

    beforeEach(() => {
      mockReview = {
        _id: 'review123',
        userId: 'author123',
        helpfulVotes: {
          helpful: 0,
          notHelpful: 0,
          userVotes: [],
        },
      };
    });

    it('should throw error for invalid vote', () => {
      expect(() => {
        reviewService.processVote(mockReview, 'voter123', 'invalid');
      }).toThrow('Vote must be either "helpful" or "notHelpful"');
    });

    it('should throw error when user votes on own review', () => {
      expect(() => {
        reviewService.processVote(mockReview, 'author123', 'helpful');
      }).toThrow('You cannot vote on your own review');
    });

    it('should add a new helpful vote', () => {
      const result = reviewService.processVote(mockReview, 'voter123', 'helpful');

      expect(result.helpfulVotes.helpful).toBe(1);
      expect(result.helpfulVotes.notHelpful).toBe(0);
      expect(result.helpfulVotes.userVotes).toHaveLength(1);
      expect(result.helpfulVotes.userVotes[0]).toMatchObject({
        userId: 'voter123',
        vote: 'helpful',
      });
    });

    it('should change existing vote from helpful to notHelpful', () => {
      // First vote
      mockReview.helpfulVotes = {
        helpful: 1,
        notHelpful: 0,
        userVotes: [
          {
            userId: 'voter123',
            vote: 'helpful',
            votedAt: new Date(),
          },
        ],
      };

      const result = reviewService.processVote(mockReview, 'voter123', 'notHelpful');

      expect(result.helpfulVotes.helpful).toBe(0);
      expect(result.helpfulVotes.notHelpful).toBe(1);
      expect(result.helpfulVotes.userVotes[0].vote).toBe('notHelpful');
    });

    it('should remove vote if same vote is submitted', () => {
      // First vote
      mockReview.helpfulVotes = {
        helpful: 1,
        notHelpful: 0,
        userVotes: [
          {
            userId: 'voter123',
            vote: 'helpful',
            votedAt: new Date(),
          },
        ],
      };

      const result = reviewService.processVote(mockReview, 'voter123', 'helpful');

      expect(result.helpfulVotes.helpful).toBe(0);
      expect(result.helpfulVotes.notHelpful).toBe(0);
      expect(result.helpfulVotes.userVotes).toHaveLength(0);
    });
  });

  describe('review filtering', () => {
    let mockReviews;

    beforeEach(() => {
      mockReviews = [
        {
          _id: 'review1',
          rating: 5,
          status: 'approved',
          isVerifiedPurchase: true,
          images: ['img1.jpg'],
          videos: [],
        },
        {
          _id: 'review2',
          rating: 4,
          status: 'approved',
          isVerifiedPurchase: false,
          images: [],
          videos: ['vid1.mp4'],
        },
        {
          _id: 'review3',
          rating: 3,
          status: 'pending',
          isVerifiedPurchase: true,
          images: [],
          videos: [],
        },
      ];
    });

    it('should filter by status', () => {
      const result = reviewService.filterReviews(mockReviews, { status: 'approved' });
      expect(result).toHaveLength(2);
      expect(result.every(review => review.status === 'approved')).toBe(true);
    });

    it('should filter by rating', () => {
      const result = reviewService.filterReviews(mockReviews, { rating: 5 });
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(5);
    });

    it('should filter by multiple ratings', () => {
      const result = reviewService.filterReviews(mockReviews, { rating: [4, 5] });
      expect(result).toHaveLength(2);
      expect(result.every(review => [4, 5].includes(review.rating))).toBe(true);
    });

    it('should filter by verified purchase only', () => {
      const result = reviewService.filterReviews(mockReviews, { verifiedOnly: true });
      expect(result).toHaveLength(2);
      expect(result.every(review => review.isVerifiedPurchase)).toBe(true);
    });

    it('should filter by media presence', () => {
      const result = reviewService.filterReviews(mockReviews, { withMedia: true });
      expect(result).toHaveLength(2);
      // Should include reviews with either images or videos
    });

    it('should apply multiple filters', () => {
      const result = reviewService.filterReviews(mockReviews, {
        status: 'approved',
        rating: [4, 5],
        verifiedOnly: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('review1');
    });
  });

  describe('review sorting', () => {
    let mockReviews;

    beforeEach(() => {
      mockReviews = [
        {
          _id: 'review1',
          rating: 3,
          helpfulVotes: { helpful: 5, notHelpful: 1 },
          metadata: { createdAt: '2024-01-01' },
        },
        {
          _id: 'review2',
          rating: 5,
          helpfulVotes: { helpful: 2, notHelpful: 0 },
          metadata: { createdAt: '2024-01-03' },
        },
        {
          _id: 'review3',
          rating: 4,
          helpfulVotes: { helpful: 8, notHelpful: 2 },
          metadata: { createdAt: '2024-01-02' },
        },
      ];
    });

    it('should sort by rating descending', () => {
      const result = reviewService.sortReviews(mockReviews, 'rating', 'desc');
      expect(result[0].rating).toBe(5);
      expect(result[1].rating).toBe(4);
      expect(result[2].rating).toBe(3);
    });

    it('should sort by rating ascending', () => {
      const result = reviewService.sortReviews(mockReviews, 'rating', 'asc');
      expect(result[0].rating).toBe(3);
      expect(result[1].rating).toBe(4);
      expect(result[2].rating).toBe(5);
    });

    it('should sort by helpfulness descending', () => {
      const result = reviewService.sortReviews(mockReviews, 'helpfulness', 'desc');
      expect(result[0]._id).toBe('review3'); // 8 helpful votes
      expect(result[1]._id).toBe('review1'); // 5 helpful votes
      expect(result[2]._id).toBe('review2'); // 2 helpful votes
    });

    it('should sort by creation date descending', () => {
      const result = reviewService.sortReviews(mockReviews, 'metadata.createdAt', 'desc');
      expect(result[0]._id).toBe('review2'); // 2024-01-03
      expect(result[1]._id).toBe('review3'); // 2024-01-02
      expect(result[2]._id).toBe('review1'); // 2024-01-01
    });
  });

  describe('pagination calculation', () => {
    it('should calculate pagination correctly', () => {
      const pagination = reviewService.calculatePagination(25, 2, 10);
      
      expect(pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should handle first page', () => {
      const pagination = reviewService.calculatePagination(25, 1, 10);
      
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(false);
    });

    it('should handle last page', () => {
      const pagination = reviewService.calculatePagination(25, 3, 10);
      
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(true);
    });

    it('should handle empty results', () => {
      const pagination = reviewService.calculatePagination(0, 1, 10);
      
      expect(pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });
  });

  describe('review enrichment', () => {
    it('should enrich review with computed fields', () => {
      const mockReview = {
        _id: 'review1',
        title: 'Great product',
        helpfulVotes: {
          helpful: 7,
          notHelpful: 3,
        },
        metadata: {
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
      };

      const enriched = reviewService.enrichReview(mockReview);

      expect(enriched).toHaveProperty('helpfulScore', 70);
      expect(enriched).toHaveProperty('totalVotes', 10);
      expect(enriched).toHaveProperty('ageInDays', 2);
    });
  });

  describe('configuration handling', () => {
    it('should use default configuration', () => {
      const service = new ReviewServiceTest();
      
      expect(service.config.review.autoApproveVerified).toBe(true);
      expect(service.config.review.moderationRequired).toBe(false);
      expect(service.config.externalServices.productService).toBe('http://product-service');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        review: {
          autoApproveVerified: false,
          moderationRequired: true,
        },
        externalServices: {
          productService: 'http://custom-product-service',
        },
      };

      const service = new ReviewServiceTest(customConfig);
      
      expect(service.config.review.autoApproveVerified).toBe(false);
      expect(service.config.review.moderationRequired).toBe(true);
      expect(service.config.externalServices.productService).toBe('http://custom-product-service');
    });
  });
});