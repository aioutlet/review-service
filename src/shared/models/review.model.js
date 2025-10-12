import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[0-9a-fA-F]{24}$/.test(v); // Basic ObjectId validation
        },
        message: 'Invalid product ID format',
      },
    },
    userId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[0-9a-fA-F]{24}$/.test(v); // Basic ObjectId validation
        },
        message: 'Invalid user ID format',
      },
    },
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    images: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
          },
          message: 'Invalid image URL format',
        },
      },
    ],
    videos: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^https?:\/\/.+\.(mp4|webm|ogg)$/i.test(v);
          },
          message: 'Invalid video URL format',
        },
      },
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
      index: true,
    },
    orderReference: {
      type: String,
      sparse: true, // Index only non-null values
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'flagged'],
        message: 'Status must be one of: pending, approved, rejected, flagged',
      },
      default: 'pending',
      index: true,
    },
    moderationNotes: {
      type: String,
      maxlength: [500, 'Moderation notes cannot exceed 500 characters'],
    },
    helpfulVotes: {
      helpful: {
        type: Number,
        default: 0,
        min: 0,
      },
      notHelpful: {
        type: Number,
        default: 0,
        min: 0,
      },
      userVotes: [
        {
          userId: {
            type: String,
            required: true,
          },
          vote: {
            type: String,
            enum: ['helpful', 'notHelpful'],
            required: true,
          },
          votedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    responses: [
      {
        responderId: {
          type: String,
          required: true,
        },
        responderType: {
          type: String,
          enum: ['seller', 'admin'],
          required: true,
        },
        responderName: {
          type: String,
          required: true,
        },
        message: {
          type: String,
          required: true,
          maxlength: [1000, 'Response cannot exceed 1000 characters'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isPublic: {
          type: Boolean,
          default: true,
        },
      },
    ],
    flags: [
      {
        flaggedBy: {
          type: String,
          required: true,
        },
        flaggedByName: String,
        reason: {
          type: String,
          enum: ['spam', 'inappropriate', 'fake', 'offensive', 'copyright', 'other'],
          required: true,
        },
        description: {
          type: String,
          maxlength: [500, 'Flag description cannot exceed 500 characters'],
        },
        flaggedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['pending', 'resolved', 'dismissed'],
          default: 'pending',
        },
      },
    ],
    sentiment: {
      score: {
        type: Number,
        min: -1,
        max: 1,
      },
      label: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },
    },
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      moderatedAt: Date,
      moderatedBy: String,
      moderatorName: String,
      ipAddress: String,
      userAgent: String,
      source: {
        type: String,
        enum: ['web', 'mobile', 'api'],
        default: 'web',
      },
    },
  },
  {
    timestamps: { createdAt: 'metadata.createdAt', updatedAt: 'metadata.updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance optimization
reviewSchema.index({ productId: 1, status: 1 });
reviewSchema.index({ userId: 1, 'metadata.createdAt': -1 });
reviewSchema.index({ status: 1, 'metadata.createdAt': -1 });
reviewSchema.index({ isVerifiedPurchase: 1, rating: 1 });
reviewSchema.index({ 'sentiment.label': 1, rating: 1 });

// Compound index for unique user review per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Text search index for review content
reviewSchema.index({
  title: 'text',
  comment: 'text',
  username: 'text',
});

// Virtual for helpful score percentage
reviewSchema.virtual('helpfulScore').get(function () {
  const total = this.helpfulVotes.helpful + this.helpfulVotes.notHelpful;
  return total > 0 ? Math.round((this.helpfulVotes.helpful / total) * 100) : 0;
});

// Virtual for total votes
reviewSchema.virtual('totalVotes').get(function () {
  return this.helpfulVotes.helpful + this.helpfulVotes.notHelpful;
});

// Virtual for review age in days
reviewSchema.virtual('ageInDays').get(function () {
  return Math.floor((Date.now() - this.metadata.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update updatedAt
reviewSchema.pre('save', function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Pre-save middleware for username validation
reviewSchema.pre('save', async function (next) {
  if (
    this.isNew &&
    (!this.title || this.title.trim().length === 0) &&
    (!this.comment || this.comment.trim().length === 0)
  ) {
    const error = new Error('Review must have either a title or comment');
    return next(error);
  }
  next();
});

// Static method to get review statistics for a product
reviewSchema.statics.getProductStats = async function (productId) {
  const pipeline = [
    { $match: { productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating',
        },
        verifiedReviews: {
          $sum: { $cond: ['$isVerifiedPurchase', 1, 0] },
        },
        sentimentDistribution: {
          $push: '$sentiment.label',
        },
      },
    },
  ];

  const [result] = await this.aggregate(pipeline);
  return (
    result || {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: [],
      verifiedReviews: 0,
      sentimentDistribution: [],
    }
  );
};

// Instance method to check if user can vote
reviewSchema.methods.canUserVote = function (userId) {
  return !this.helpfulVotes.userVotes.some((vote) => vote.userId === userId);
};

// Instance method to get user's vote
reviewSchema.methods.getUserVote = function (userId) {
  const userVote = this.helpfulVotes.userVotes.find((vote) => vote.userId === userId);
  return userVote ? userVote.vote : null;
};

export default mongoose.model('Review', reviewSchema);
