// MongoDB initialization script for Review Service
// This script sets up the database, collections, and indexes

// Switch to the reviews database
db = db.getSiblingDB('aioutlet_reviews');

// Create collections with validation schemas

// ====================================================
// REVIEWS COLLECTION
// ====================================================
db.createCollection('reviews', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'productId', 'rating', 'title', 'content', 'status'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID is required and must be a string',
        },
        productId: {
          bsonType: 'string',
          description: 'Product ID is required and must be a string',
        },
        rating: {
          bsonType: 'int',
          minimum: 1,
          maximum: 5,
          description: 'Rating must be an integer between 1 and 5',
        },
        title: {
          bsonType: 'string',
          minLength: 5,
          maxLength: 200,
          description: 'Title must be between 5 and 200 characters',
        },
        content: {
          bsonType: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Content must be between 10 and 2000 characters',
        },
        status: {
          enum: ['pending', 'approved', 'rejected', 'flagged'],
          description: 'Status must be one of: pending, approved, rejected, flagged',
        },
        isVerifiedPurchase: {
          bsonType: 'bool',
          description: 'Verified purchase flag must be a boolean',
        },
        sentiment: {
          bsonType: 'object',
          properties: {
            score: {
              bsonType: 'double',
              minimum: -1,
              maximum: 1,
            },
            magnitude: {
              bsonType: 'double',
              minimum: 0,
            },
            label: {
              enum: ['positive', 'negative', 'neutral', 'mixed'],
            },
          },
        },
        votes: {
          bsonType: 'object',
          properties: {
            helpful: { bsonType: 'int', minimum: 0 },
            notHelpful: { bsonType: 'int', minimum: 0 },
            spam: { bsonType: 'int', minimum: 0 },
          },
        },
        metadata: {
          bsonType: 'object',
          properties: {
            userAgent: { bsonType: 'string' },
            ipAddress: { bsonType: 'string' },
            source: { bsonType: 'string' },
            deviceType: { bsonType: 'string' },
          },
        },
      },
    },
  },
});

// ====================================================
// PRODUCT RATINGS COLLECTION
// ====================================================
db.createCollection('productratings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['productId', 'averageRating', 'totalReviews'],
      properties: {
        productId: {
          bsonType: 'string',
          description: 'Product ID is required and must be a string',
        },
        averageRating: {
          bsonType: 'double',
          minimum: 0,
          maximum: 5,
          description: 'Average rating must be between 0 and 5',
        },
        totalReviews: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total reviews must be a non-negative integer',
        },
        ratingDistribution: {
          bsonType: 'object',
          properties: {
            1: { bsonType: 'int', minimum: 0 },
            2: { bsonType: 'int', minimum: 0 },
            3: { bsonType: 'int', minimum: 0 },
            4: { bsonType: 'int', minimum: 0 },
            5: { bsonType: 'int', minimum: 0 },
          },
        },
      },
    },
  },
});

// ====================================================
// REVIEW FLAGS COLLECTION
// ====================================================
db.createCollection('reviewflags', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['reviewId', 'flaggedBy', 'reason', 'status'],
      properties: {
        reviewId: {
          bsonType: 'objectId',
          description: 'Review ID is required and must be an ObjectId',
        },
        flaggedBy: {
          bsonType: 'string',
          description: 'Flagged by user ID is required',
        },
        reason: {
          enum: ['spam', 'inappropriate', 'fake', 'irrelevant', 'other'],
          description: 'Reason must be one of the predefined values',
        },
        status: {
          enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
          description: 'Status must be one of: pending, reviewed, resolved, dismissed',
        },
      },
    },
  },
});

// ====================================================
// REVIEW VOTES COLLECTION
// ====================================================
db.createCollection('reviewvotes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['reviewId', 'userId', 'voteType'],
      properties: {
        reviewId: {
          bsonType: 'objectId',
          description: 'Review ID is required and must be an ObjectId',
        },
        userId: {
          bsonType: 'string',
          description: 'User ID is required',
        },
        voteType: {
          enum: ['helpful', 'notHelpful', 'spam'],
          description: 'Vote type must be one of: helpful, notHelpful, spam',
        },
      },
    },
  },
});

// ====================================================
// CREATE INDEXES
// ====================================================

// Reviews collection indexes
db.reviews.createIndex({ productId: 1 }, { background: true });
db.reviews.createIndex({ userId: 1 }, { background: true });
db.reviews.createIndex({ status: 1 }, { background: true });
db.reviews.createIndex({ createdAt: -1 }, { background: true });
db.reviews.createIndex({ rating: 1 }, { background: true });
db.reviews.createIndex({ isVerifiedPurchase: 1 }, { background: true });
db.reviews.createIndex({ 'votes.helpful': -1 }, { background: true });
db.reviews.createIndex({ 'sentiment.label': 1 }, { background: true });

// Compound indexes for common queries
db.reviews.createIndex({ productId: 1, status: 1, createdAt: -1 }, { background: true });
db.reviews.createIndex({ userId: 1, productId: 1 }, { unique: true, background: true });
db.reviews.createIndex({ productId: 1, rating: 1 }, { background: true });
db.reviews.createIndex({ status: 1, createdAt: 1 }, { background: true });

// Text search index for review content
db.reviews.createIndex(
  {
    title: 'text',
    content: 'text',
  },
  {
    background: true,
    weights: {
      title: 10,
      content: 5,
    },
    name: 'review_text_search',
  }
);

// Product ratings collection indexes
db.productratings.createIndex({ productId: 1 }, { unique: true, background: true });
db.productratings.createIndex({ averageRating: -1 }, { background: true });
db.productratings.createIndex({ totalReviews: -1 }, { background: true });
db.productratings.createIndex({ updatedAt: -1 }, { background: true });

// Review flags collection indexes
db.reviewflags.createIndex({ reviewId: 1 }, { background: true });
db.reviewflags.createIndex({ flaggedBy: 1 }, { background: true });
db.reviewflags.createIndex({ status: 1 }, { background: true });
db.reviewflags.createIndex({ reason: 1 }, { background: true });
db.reviewflags.createIndex({ createdAt: -1 }, { background: true });
db.reviewflags.createIndex({ reviewId: 1, flaggedBy: 1 }, { unique: true, background: true });

// Review votes collection indexes
db.reviewvotes.createIndex({ reviewId: 1 }, { background: true });
db.reviewvotes.createIndex({ userId: 1 }, { background: true });
db.reviewvotes.createIndex({ voteType: 1 }, { background: true });
db.reviewvotes.createIndex({ reviewId: 1, userId: 1 }, { unique: true, background: true });
db.reviewvotes.createIndex({ createdAt: -1 }, { background: true });

// ====================================================
// INSERT SAMPLE DATA (for development)
// ====================================================

// Sample product ratings
db.productratings.insertMany([
  {
    productId: 'product-1',
    averageRating: 4.5,
    totalReviews: 12,
    ratingDistribution: {
      1: 0,
      2: 1,
      3: 2,
      4: 4,
      5: 5,
    },
    sentimentAnalysis: {
      positive: 10,
      negative: 1,
      neutral: 1,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    productId: 'product-2',
    averageRating: 3.8,
    totalReviews: 8,
    ratingDistribution: {
      1: 1,
      2: 0,
      3: 2,
      4: 3,
      5: 2,
    },
    sentimentAnalysis: {
      positive: 5,
      negative: 2,
      neutral: 1,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

// Sample reviews
db.reviews.insertMany([
  {
    userId: 'user-1',
    productId: 'product-1',
    rating: 5,
    title: 'Excellent product!',
    content:
      'This product exceeded my expectations. The quality is outstanding and the features work perfectly. I would definitely recommend it to others.',
    status: 'approved',
    isVerifiedPurchase: true,
    sentiment: {
      score: 0.8,
      magnitude: 0.9,
      label: 'positive',
    },
    votes: {
      helpful: 5,
      notHelpful: 0,
      spam: 0,
    },
    metadata: {
      source: 'web',
      deviceType: 'desktop',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    userId: 'user-2',
    productId: 'product-1',
    rating: 4,
    title: 'Good value for money',
    content: 'The product is good overall. Some minor issues but nothing major. Good value for the price point.',
    status: 'approved',
    isVerifiedPurchase: true,
    sentiment: {
      score: 0.4,
      magnitude: 0.6,
      label: 'positive',
    },
    votes: {
      helpful: 3,
      notHelpful: 1,
      spam: 0,
    },
    metadata: {
      source: 'mobile',
      deviceType: 'smartphone',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

print('✅ Database initialization completed successfully');
print('📊 Collections created: reviews, productratings, reviewflags, reviewvotes');
print('📈 Indexes created for optimal query performance');
print('🔧 Sample data inserted for development');
print('🎯 Review service database is ready!');
