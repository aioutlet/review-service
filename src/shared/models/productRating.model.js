import mongoose from 'mongoose';

const productRatingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    averageRating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    ratingDistribution: {
      1: { type: Number, default: 0, min: 0 },
      2: { type: Number, default: 0, min: 0 },
      3: { type: Number, default: 0, min: 0 },
      4: { type: Number, default: 0, min: 0 },
      5: { type: Number, default: 0, min: 0 },
    },
    verifiedPurchaseRating: {
      type: Number,
      min: 0,
      max: 5,
    },
    verifiedReviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sentiment: {
      positive: { type: Number, default: 0, min: 0 },
      neutral: { type: Number, default: 0, min: 0 },
      negative: { type: Number, default: 0, min: 0 },
    },
    qualityMetrics: {
      averageHelpfulScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      totalHelpfulVotes: {
        type: Number,
        default: 0,
        min: 0,
      },
      reviewsWithMedia: {
        type: Number,
        default: 0,
        min: 0,
      },
      averageReviewLength: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    trends: {
      last30Days: {
        totalReviews: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
      },
      last7Days: {
        totalReviews: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
      },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastReviewDate: {
      type: Date,
    },
    firstReviewDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for rating percentage (out of 100)
productRatingSchema.virtual('ratingPercentage').get(function () {
  return this.totalReviews > 0 ? Math.round((this.averageRating / 5) * 100) : 0;
});

// Virtual for verified purchase percentage
productRatingSchema.virtual('verifiedPercentage').get(function () {
  return this.totalReviews > 0 ? Math.round((this.verifiedReviewsCount / this.totalReviews) * 100) : 0;
});

// Virtual for rating distribution as percentages
productRatingSchema.virtual('ratingDistributionPercentage').get(function () {
  if (this.totalReviews === 0) {
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }

  return {
    1: Math.round((this.ratingDistribution[1] / this.totalReviews) * 100),
    2: Math.round((this.ratingDistribution[2] / this.totalReviews) * 100),
    3: Math.round((this.ratingDistribution[3] / this.totalReviews) * 100),
    4: Math.round((this.ratingDistribution[4] / this.totalReviews) * 100),
    5: Math.round((this.ratingDistribution[5] / this.totalReviews) * 100),
  };
});

// Virtual for sentiment distribution as percentages
productRatingSchema.virtual('sentimentPercentage').get(function () {
  const total = this.sentiment.positive + this.sentiment.neutral + this.sentiment.negative;
  if (total === 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }

  return {
    positive: Math.round((this.sentiment.positive / total) * 100),
    neutral: Math.round((this.sentiment.neutral / total) * 100),
    negative: Math.round((this.sentiment.negative / total) * 100),
  };
});

// Instance method to check if rating is stale
productRatingSchema.methods.isStale = function (thresholdMinutes = 5) {
  const now = new Date();
  const diffInMinutes = (now - this.lastUpdated) / (1000 * 60);
  return diffInMinutes > thresholdMinutes;
};

// Static method to get top rated products
productRatingSchema.statics.getTopRated = async function (limit = 10, minReviews = 5) {
  return this.find({
    totalReviews: { $gte: minReviews },
  })
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(limit)
    .lean();
};

// Static method to get trending products (high activity recently)
productRatingSchema.statics.getTrending = async function (limit = 10) {
  return this.find({
    'trends.last7Days.totalReviews': { $gt: 0 },
  })
    .sort({
      'trends.last7Days.totalReviews': -1,
      'trends.last7Days.averageRating': -1,
    })
    .limit(limit)
    .lean();
};

// Pre-save middleware to update timestamp
productRatingSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('ProductRating', productRatingSchema, 'product_ratings');
