// Mock setup for all external dependencies

// Mock Mongoose models
export const mockReview = {
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOneAndUpdate: jest.fn(),
  save: jest.fn(),
  constructor: jest.fn(),
};

// Mock cache service
export const mockCacheService = {
  deleteProductReviews: jest.fn(),
  deleteUserReviews: jest.fn(),
  deleteByPattern: jest.fn(),
};

// Mock messaging publisher
export const mockPublisher = {
  publishReviewCreated: jest.fn(),
  publishReviewUpdated: jest.fn(),
  publishReviewDeleted: jest.fn(),
};

// Mock logger
export const mockLogger = {
  operationStart: jest.fn().mockReturnValue(Date.now()),
  operationComplete: jest.fn(),
  operationFailed: jest.fn(),
  withCorrelationId: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  info: jest.fn(),
  error: jest.fn(),
  business: jest.fn(),
};

// Mock axios
export const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
};

// Mock config
export const mockConfig = {
  review: {
    autoApproveVerified: true,
    moderationRequired: false,
  },
  externalServices: {
    productService: 'http://product-service',
    orderService: 'http://order-service',
  },
};

// Mock tracing helpers
export const mockCreateOperationSpan = jest.fn().mockReturnValue({
  setStatus: jest.fn(),
  addEvent: jest.fn(),
  end: jest.fn(),
});

// Reset all mocks
export const resetAllMocks = () => {
  Object.values(mockReview).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  Object.values(mockCacheService).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  Object.values(mockPublisher).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  Object.values(mockLogger).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  Object.values(mockAxios).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  mockCreateOperationSpan.mockClear();

  // Reset logger chain
  mockLogger.withCorrelationId.mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  });
};
