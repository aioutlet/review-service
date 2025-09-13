// Test data fixtures for review service tests

export const mockUser = {
  userId: '507f1f77bcf86cd799439011',
  username: 'testuser',
  isAdmin: false,
};

export const mockAdminUser = {
  userId: '507f1f77bcf86cd799439012',
  username: 'adminuser',
  isAdmin: true,
};

export const mockReviewData = {
  productId: '507f1f77bcf86cd799439013',
  rating: 5,
  title: 'Great product!',
  comment: 'This product exceeded my expectations. Highly recommend!',
  metadata: {
    source: 'web',
  },
};

export const mockReviewDataWithOrder = {
  ...mockReviewData,
  orderReference: 'ORD-12345',
};

export const mockSavedReview = {
  _id: '507f1f77bcf86cd799439014',
  ...mockReviewData,
  userId: mockUser.userId,
  username: mockUser.username,
  isVerifiedPurchase: false,
  status: 'approved',
  helpfulVotes: {
    helpful: 0,
    notHelpful: 0,
    userVotes: [],
  },
  metadata: {
    ...mockReviewData.metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const mockExistingReview = {
  _id: '507f1f77bcf86cd799439015',
  productId: mockReviewData.productId,
  userId: mockUser.userId,
  username: mockUser.username,
  rating: 4,
  title: 'Existing review',
  comment: 'This is an existing review',
  isVerifiedPurchase: true,
  status: 'approved',
  helpfulVotes: {
    helpful: 5,
    notHelpful: 2,
    userVotes: [
      {
        userId: '507f1f77bcf86cd799439016',
        vote: 'helpful',
        votedAt: new Date(),
      },
    ],
  },
  metadata: {
    source: 'web',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    updatedAt: new Date(),
  },
};

export const mockProductReviews = [
  {
    _id: '507f1f77bcf86cd799439017',
    productId: mockReviewData.productId,
    userId: '507f1f77bcf86cd799439018',
    username: 'user1',
    rating: 5,
    title: 'Excellent!',
    comment: 'Love this product',
    isVerifiedPurchase: true,
    status: 'approved',
    helpfulVotes: {
      helpful: 3,
      notHelpful: 0,
      userVotes: [],
    },
    metadata: {
      source: 'web',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    },
  },
  {
    _id: '507f1f77bcf86cd799439019',
    productId: mockReviewData.productId,
    userId: '507f1f77bcf86cd799439020',
    username: 'user2',
    rating: 4,
    title: 'Good value',
    comment: 'Decent quality for the price',
    isVerifiedPurchase: false,
    status: 'approved',
    helpfulVotes: {
      helpful: 1,
      notHelpful: 1,
      userVotes: [],
    },
    metadata: {
      source: 'mobile',
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
    },
  },
];

export const mockTrendData = [
  {
    totalReviews: 15,
    averageRating: 4.2,
  },
];

export const mockUpdateData = {
  rating: 4,
  title: 'Updated title',
  comment: 'Updated comment content',
};

export const mockCorrelationId = 'test-correlation-id-123';

export const mockVoteUser = {
  userId: '507f1f77bcf86cd799439021',
  username: 'voter',
  isAdmin: false,
};