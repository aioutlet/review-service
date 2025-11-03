import Review from '../models/review.model.js';
import ProductRating from '../models/productRating.model.js';
import logger from '../observability/index.js';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';
import cacheService from './cache.service.js';
import messageBrokerService from './messageBroker.service.js';
import axios from 'axios';
import config from '../config/index.js';
import { createOperationSpan } from '../observability/tracing/helpers.js';
import mongoose from 'mongoose';

class ReviewService {
  /**
   * Create a new review
   * @param {Object} reviewData - Review data
   * @param {Object} user - User information
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Created review
   */
  async createReview(reviewData, user, correlationId) {
    const operationSpan = createOperationSpan('review.create', {
      'user.id': user.userId,
      'product.id': reviewData.productId,
      'review.rating': reviewData.rating,
    });

    const startTime = logger.operationStart('createReview', null, {
      correlationId,
      userId: user.userId,
      metadata: { productId: reviewData.productId, rating: reviewData.rating },
    });

    try {
      const log = logger.withCorrelationId(correlationId);

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({
        productId: reviewData.productId,
        userId: user.userId,
      });

      if (existingReview) {
        operationSpan.setStatus(2, 'User already reviewed product'); // ERROR status
        throw new ConflictError('User has already reviewed this product');
      }

      // Validate product exists
      await this.validateProduct(reviewData.productId, correlationId);

      // Validate purchase if order reference provided
      let isVerifiedPurchase = false;
      if (reviewData.orderReference) {
        isVerifiedPurchase = await this.validatePurchase(
          user.userId,
          reviewData.productId,
          reviewData.orderReference,
          correlationId
        );
      }

      // Determine initial status
      const status = this.determineInitialStatus(isVerifiedPurchase);

      // Create review
      const review = new Review({
        ...reviewData,
        userId: user.userId,
        username: user.username,
        isVerifiedPurchase,
        status,
        createdBy: user.userId,
        updatedBy: user.userId,
        metadata: {
          ...reviewData.metadata,
          source: reviewData.source || 'web',
        },
      });

      const savedReview = await review.save();

      // Update product rating aggregate asynchronously
      this.updateProductRating(reviewData.productId, correlationId).catch((err) => {
        log.error('Failed to update product rating:', err);
      });

      // Clear product cache to refresh aggregated data
      cacheService.deleteProductReviews(reviewData.productId, correlationId).catch((err) => {
        log.error('Failed to clear product cache:', err);
      });

      // Publish event
      await messageBrokerService.publishReviewCreated(
        {
          reviewId: savedReview._id,
          productId: savedReview.productId,
          userId: savedReview.userId,
          rating: savedReview.rating,
          status: savedReview.status,
          isVerifiedPurchase: savedReview.isVerifiedPurchase,
        },
        correlationId
      );

      log.info('Review created successfully', {
        reviewId: savedReview._id,
        productId: reviewData.productId,
        userId: user.userId,
        status: savedReview.status,
      });

      // Log business event
      logger.business('review_created', null, {
        correlationId,
        userId: user.userId,
        metadata: {
          reviewId: savedReview._id,
          productId: reviewData.productId,
          rating: savedReview.rating,
          isVerifiedPurchase: savedReview.isVerifiedPurchase,
        },
      });

      operationSpan.setStatus(1); // OK status
      operationSpan.addEvent('review_created', {
        'review.id': savedReview._id.toString(),
        'review.status': savedReview.status,
      });

      logger.operationComplete('createReview', startTime, null, {
        correlationId,
        userId: user.userId,
        metadata: { reviewId: savedReview._id, status: savedReview.status },
      });

      return savedReview;
    } catch (error) {
      operationSpan.setStatus(2, error.message); // ERROR status
      operationSpan.addEvent('review_creation_failed', {
        'error.name': error.name,
        'error.message': error.message,
      });

      logger.operationFailed('createReview', startTime, error, null, {
        correlationId,
        userId: user.userId,
        metadata: { productId: reviewData.productId },
      });

      throw error;
    } finally {
      operationSpan.end();
    }
  }

  /**
   * Get reviews for a product with filtering and pagination
   * @param {String} productId - Product ID
   * @param {Object} options - Query options
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Reviews and pagination info
   */
  async getProductReviews(productId, options = {}, correlationId) {
    const operationSpan = createOperationSpan('review.get_product_reviews', {
      'product.id': productId,
      'query.page': options.page || 1,
      'query.limit': options.limit || 20,
    });

    const startTime = logger.operationStart('getProductReviews', null, {
      correlationId,
      metadata: { productId, options: Object.keys(options) },
    });

    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status = 'approved',
        rating,
        verifiedOnly = false,
        withMedia = false,
        search,
        userId,
      } = options;

      // Build filter
      const filter = { productId: new mongoose.Types.ObjectId(productId) };

      // Status filter
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }

      // Rating filter
      if (rating) {
        if (Array.isArray(rating)) {
          filter.rating = { $in: rating.map(Number) };
        } else {
          filter.rating = Number(rating);
        }
      }

      // Verified purchase filter
      if (verifiedOnly) {
        filter.isVerifiedPurchase = true;
      }

      // Media filter
      if (withMedia) {
        filter.$or = [
          { images: { $exists: true, $not: { $size: 0 } } },
          { videos: { $exists: true, $not: { $size: 0 } } },
        ];
      }

      // Search filter
      if (search) {
        filter.$text = { $search: search };
      }

      // User filter (for getting user's own reviews)
      if (userId) {
        filter.userId = userId;
      }

      // Build sort
      const sort = {};
      if (sortBy === 'helpfulness') {
        sort['helpfulVotes.helpful'] = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'rating') {
        sort.rating = sortOrder === 'desc' ? -1 : 1;
        sort['createdAt'] = -1; // Secondary sort
      } else {
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [reviews, total] = await Promise.all([
        Review.find(filter).sort(sort).skip(skip).limit(limit).select('-__v -helpfulVotes.userVotes').lean(),
        Review.countDocuments(filter),
      ]);

      // Add virtual fields manually for lean queries
      const enrichedReviews = reviews.map((review) => ({
        ...review,
        helpfulScore: this.calculateHelpfulScore(review.helpfulVotes),
        totalVotes: review.helpfulVotes.helpful + review.helpfulVotes.notHelpful,
        ageInDays: Math.floor((Date.now() - new Date(review.createdAt)) / (1000 * 60 * 60 * 24)),
      }));

      const result = {
        reviews: enrichedReviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        filters: {
          productId,
          status,
          rating,
          verifiedOnly,
          withMedia,
          search,
        },
      };

      operationSpan.setStatus(1); // OK status
      operationSpan.addEvent('reviews_retrieved', {
        'reviews.count': enrichedReviews.length,
        'reviews.total': total,
      });

      logger.operationComplete('getProductReviews', startTime, null, {
        correlationId,
        metadata: {
          productId,
          reviewsCount: enrichedReviews.length,
          totalReviews: total,
        },
      });

      return result;
    } catch (error) {
      operationSpan.setStatus(2, error.message); // ERROR status
      operationSpan.addEvent('reviews_retrieval_failed', {
        'error.name': error.name,
        'error.message': error.message,
      });

      logger.operationFailed('getProductReviews', startTime, error, null, {
        correlationId,
        metadata: { productId },
      });

      throw error;
    } finally {
      operationSpan.end();
    }
  }

  /**
   * Update a review
   * @param {String} reviewId - Review ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User information
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Updated review
   */
  async updateReview(reviewId, updateData, user, correlationId) {
    try {
      const log = logger.withCorrelationId(correlationId);

      const review = await Review.findById(reviewId);
      if (!review) {
        throw new NotFoundError('Review not found');
      }

      // Check ownership
      if (review.userId !== user.userId && !user.isAdmin) {
        throw new ForbiddenError('You can only update your own reviews');
      }

      // Validate update data
      const allowedFields = ['rating', 'title', 'comment', 'images', 'videos'];
      const updateFields = {};

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      });

      // Update review
      Object.assign(review, updateFields);
      review.metadata.updatedAt = new Date();

      // Reset status to pending if content changed significantly
      if (updateData.rating !== undefined || updateData.comment !== undefined) {
        review.status = 'pending';
      }

      const updatedReview = await review.save();

      // Update product rating if rating changed
      if (updateData.rating !== undefined) {
        // Clear product cache to refresh aggregated data
        this.clearProductCache(review.productId, correlationId).catch((err) => {
          log.error('Failed to update product rating:', err);
        });
      }

      // Publish event
      await publishReviewUpdated(
        {
          reviewId: updatedReview._id,
          productId: updatedReview.productId,
          userId: updatedReview.userId,
          changes: Object.keys(updateFields),
        },
        correlationId
      );

      log.info('Review updated successfully', {
        reviewId: updatedReview._id,
        userId: user.userId,
        changes: Object.keys(updateFields),
      });

      return updatedReview;
    } catch (error) {
      logger.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   * @param {String} reviewId - Review ID
   * @param {Object} user - User information
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteReview(reviewId, user, correlationId) {
    try {
      const log = logger.withCorrelationId(correlationId);

      const review = await Review.findById(reviewId);
      if (!review) {
        throw new NotFoundError('Review not found');
      }

      // Check ownership or admin rights
      if (review.userId !== user.userId && !user.isAdmin) {
        throw new ForbiddenError('You can only delete your own reviews');
      }

      const productId = review.productId;
      await Review.findByIdAndDelete(reviewId);

      // Update product rating
      // Clear product cache to refresh aggregated data
      this.clearProductCache(productId, correlationId).catch((err) => {
        log.error('Failed to update product rating after deletion:', err);
      });

      // Publish event
      await publishReviewDeleted(
        {
          reviewId,
          productId,
          userId: review.userId,
        },
        correlationId
      );

      log.info('Review deleted successfully', {
        reviewId,
        userId: user.userId,
        productId,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting review:', error);
      throw error;
    }
  }

  /**
   * Vote on review helpfulness
   * @param {String} reviewId - Review ID
   * @param {String} userId - User ID
   * @param {String} vote - Vote type ('helpful' or 'notHelpful')
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Updated review
   */
  async voteReviewHelpfulness(reviewId, userId, vote, correlationId) {
    try {
      const log = logger.withCorrelationId(correlationId);

      if (!['helpful', 'notHelpful'].includes(vote)) {
        throw new ValidationError('Vote must be either "helpful" or "notHelpful"');
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        throw new NotFoundError('Review not found');
      }

      // Check if user is voting on their own review
      if (review.userId === userId) {
        throw new ForbiddenError('You cannot vote on your own review');
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

      await review.save();

      log.info('Review vote recorded', {
        reviewId,
        userId,
        vote,
        helpful: review.helpfulVotes.helpful,
        notHelpful: review.helpfulVotes.notHelpful,
      });

      return review;
    } catch (error) {
      logger.error('Error voting on review:', error);
      throw error;
    }
  }

  /**
   * Get review by ID
   * @param {String} reviewId - Review ID
   * @param {String} userId - User ID (optional, for personalization)
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Review
   */
  async getReviewById(reviewId, userId = null, correlationId) {
    try {
      const review = await Review.findById(reviewId).lean();
      if (!review) {
        throw new NotFoundError('Review not found');
      }

      // Add computed fields
      const enrichedReview = {
        ...review,
        helpfulScore: this.calculateHelpfulScore(review.helpfulVotes),
        totalVotes: review.helpfulVotes.helpful + review.helpfulVotes.notHelpful,
        ageInDays: Math.floor((Date.now() - review.metadata.createdAt) / (1000 * 60 * 60 * 24)),
      };

      // Add user-specific data if userId provided
      if (userId) {
        const userVote = review.helpfulVotes.userVotes.find((v) => v.userId === userId);
        enrichedReview.userVote = userVote ? userVote.vote : null;
        enrichedReview.isOwnReview = review.userId === userId;
      }

      return enrichedReview;
    } catch (error) {
      logger.error('Error getting review by ID:', error);
      throw error;
    }
  }

  /**
   * Clear product cache to refresh aggregated data
   * @param {String} productId - Product ID
   * @param {String} correlationId - Request correlation ID
   */
  async clearProductCache(productId, correlationId) {
    try {
      await cacheService.deleteProductReviews(productId, correlationId);
    } catch (error) {
      logger.error('Error clearing product cache:', error);
    }
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
    if (config.review.autoApproveVerified && isVerifiedPurchase) {
      return 'approved';
    }
    return config.review.moderationRequired ? 'pending' : 'approved';
  }

  /**
   * Validate product exists
   * @param {String} productId - Product ID
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Validation result
   */
  async validateProduct(productId, correlationId) {
    try {
      const response = await axios.get(
        `${config.externalServices.productService}/api/products/internal/${productId}/exists`,
        {
          headers: {
            'X-Correlation-ID': correlationId,
          },
          timeout: 5000,
        }
      );

      if (!response.data.exists) {
        throw new NotFoundError('Product not found');
      }

      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundError('Product not found');
      }
      logger.error('Error validating product:', error);
      // Don't fail review creation if product service is down
      return true;
    }
  }

  /**
   * Validate purchase
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @param {String} orderReference - Order reference
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Validation result
   */
  async validatePurchase(userId, productId, orderReference, correlationId) {
    try {
      const response = await axios.post(
        `${config.externalServices.orderService}/api/v1/internal/orders/validate-purchase`,
        {
          userId,
          productId,
          orderReference,
        },
        {
          headers: {
            'X-Correlation-ID': correlationId,
          },
          timeout: 5000,
        }
      );

      return response.data.isValid || false;
    } catch (error) {
      logger.error('Error validating purchase:', error);
      // Return false if order service is down or validation fails
      return false;
    }
  }

  /**
   * Update product rating aggregate in product_ratings collection
   * @param {String} productId - Product ID
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Updated rating data
   */
  async updateProductRating(productId, correlationId) {
    const operationSpan = createOperationSpan('review.update_product_rating', {
      'product.id': productId,
    });

    const startTime = logger.operationStart('updateProductRating', null, {
      correlationId,
      metadata: { productId },
    });

    try {
      const log = logger.withCorrelationId(correlationId);

      // Convert string productId to ObjectId for MongoDB query
      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(productId);
      } catch (error) {
        // If conversion fails, keep original string ID
        objectId = productId;
        logger.info('Failed to convert productId:', productId, 'keeping as string');
      }

      // Aggregate review data from reviews collection
      const pipeline = [
        { $match: { productId: objectId, status: 'approved' } },
        {
          $group: {
            _id: '$productId',
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratingDistribution: { $push: '$rating' },
            verifiedReviews: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } },
            verifiedRatingSum: { $sum: { $cond: ['$isVerifiedPurchase', '$rating', 0] } },
            totalHelpfulVotes: { $sum: '$helpfulCount' },
            averageReviewLength: { $avg: { $strLenCP: { $ifNull: ['$comment', ''] } } },
            lastReviewDate: { $max: '$createdAt' },
            firstReviewDate: { $min: '$createdAt' },
          },
        },
      ];

      const [result] = await Review.aggregate(pipeline);

      if (result) {
        // Calculate rating distribution
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        result.ratingDistribution.forEach((rating) => {
          distribution[rating]++;
        });

        // Calculate verified purchase rating
        const verifiedRating = result.verifiedReviews > 0 ? result.verifiedRatingSum / result.verifiedReviews : null;

        // Calculate trends (last 7 and 30 days)
        const trends = await this.calculateReviewTrends(productId);

        const ratingData = {
          productId,
          averageRating: Math.round(result.averageRating * 10) / 10,
          totalReviews: result.totalReviews,
          ratingDistribution: distribution,
          verifiedPurchaseRating: verifiedRating ? Math.round(verifiedRating * 10) / 10 : null,
          verifiedReviewsCount: result.verifiedReviews,
          qualityMetrics: {
            averageHelpfulScore:
              result.totalHelpfulVotes > 0 ? Math.round((result.totalHelpfulVotes / result.totalReviews) * 100) : 0,
            totalHelpfulVotes: result.totalHelpfulVotes,
            reviewsWithMedia: 0, // TODO: Implement media counting
            averageReviewLength: Math.round(result.averageReviewLength || 0),
          },
          trends,
          lastReviewDate: result.lastReviewDate,
          firstReviewDate: result.firstReviewDate,
        };

        // Update or create product rating record
        const updatedRating = await ProductRating.findOneAndUpdate({ productId }, ratingData, {
          upsert: true,
          new: true,
          runValidators: true,
        });

        // Cache the updated rating
        await cacheService.setProductRating(productId, ratingData, correlationId).catch((err) => {
          log.error('Failed to cache product rating:', err);
        });

        // Publish rating updated event
        await messageBrokerService.publishRatingUpdated(
          {
            productId,
            averageRating: ratingData.averageRating,
            totalReviews: ratingData.totalReviews,
            ratingDistribution: distribution,
          },
          correlationId
        );

        log.info('Product rating updated', {
          productId,
          averageRating: ratingData.averageRating,
          totalReviews: ratingData.totalReviews,
        });

        operationSpan.setStatus(1);
        logger.operationComplete('updateProductRating', startTime, null, {
          correlationId,
          metadata: { productId, totalReviews: ratingData.totalReviews },
        });

        return updatedRating;
      } else {
        // No reviews found, set default rating
        const defaultRating = {
          productId,
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          verifiedPurchaseRating: null,
          verifiedReviewsCount: 0,
          qualityMetrics: {
            averageHelpfulScore: 0,
            totalHelpfulVotes: 0,
            reviewsWithMedia: 0,
            averageReviewLength: 0,
          },
          trends: {
            last30Days: { totalReviews: 0, averageRating: 0 },
            last7Days: { totalReviews: 0, averageRating: 0 },
          },
        };

        const updatedRating = await ProductRating.findOneAndUpdate({ productId }, defaultRating, {
          upsert: true,
          new: true,
          runValidators: true,
        });

        operationSpan.setStatus(1);
        logger.operationComplete('updateProductRating', startTime, null, {
          correlationId,
          metadata: { productId, totalReviews: 0 },
        });

        return updatedRating;
      }
    } catch (error) {
      operationSpan.setStatus(2, error.message);
      logger.operationFailed('updateProductRating', startTime, error, null, {
        correlationId,
        metadata: { productId },
      });
      throw error;
    } finally {
      operationSpan.end();
    }
  }

  /**
   * Calculate review trends for last 7 and 30 days
   * @param {String} productId - Product ID
   * @returns {Promise<Object>} Trends data
   */
  async calculateReviewTrends(productId) {
    // Convert string productId to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(productId);
    } catch (error) {
      // If conversion fails, keep original string ID
      objectId = productId;
    }

    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [trends7, trends30] = await Promise.all([
      Review.aggregate([
        {
          $match: {
            productId: objectId,
            status: 'approved',
            createdAt: { $gte: last7Days },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
          },
        },
      ]),
      Review.aggregate([
        {
          $match: {
            productId: objectId,
            status: 'approved',
            createdAt: { $gte: last30Days },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
          },
        },
      ]),
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

  /**
   * Get internal statistics for admin dashboard
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Statistics including total, pending, average rating, and growth
   */
  async getInternalStats(correlationId) {
    const log = logger.withCorrelationId(correlationId);

    try {
      log.info('Fetching review statistics for admin dashboard');

      // Get current stats
      const [totalReviews, pendingReviews, approvedReviews] = await Promise.all([
        Review.countDocuments({}),
        Review.countDocuments({ status: 'pending' }),
        Review.countDocuments({ status: 'approved' }),
      ]);

      // Get average rating from approved reviews
      const avgRatingResult = await Review.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
          },
        },
      ]);

      const averageRating = avgRatingResult[0]?.averageRating
        ? Math.round(avgRatingResult[0].averageRating * 10) / 10
        : 0;

      // Calculate growth (reviews from last 30 days vs previous 30 days)
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [recentReviews, previousReviews] = await Promise.all([
        Review.countDocuments({
          createdAt: { $gte: last30Days, $lt: now },
        }),
        Review.countDocuments({
          createdAt: { $gte: last60Days, $lt: last30Days },
        }),
      ]);

      // Calculate growth percentage
      let growth = 0;
      if (previousReviews > 0) {
        growth = Math.round(((recentReviews - previousReviews) / previousReviews) * 100 * 10) / 10;
      } else if (recentReviews > 0) {
        growth = 100; // 100% growth if no previous reviews
      }

      const stats = {
        total: totalReviews,
        pending: pendingReviews,
        approved: approvedReviews,
        averageRating: averageRating,
        growth: growth,
      };

      log.info('Review statistics fetched successfully', {
        businessEvent: 'ADMIN_STATS_FETCHED',
        stats,
      });

      return stats;
    } catch (error) {
      log.error('Failed to fetch review statistics', {
        businessEvent: 'ADMIN_STATS_ERROR',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all reviews for admin dashboard with filtering and pagination
   * @param {Object} options - Query options
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Reviews with pagination info
   */
  async getAllReviewsForAdmin(options, correlationId) {
    const log = logger.withCorrelationId(correlationId);

    try {
      const { status, rating, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

      log.info('Fetching all reviews for admin', { options });

      // Build query filter
      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (rating) {
        filter.rating = parseInt(rating);
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { comment: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const [reviews, total] = await Promise.all([
        Review.find(filter).sort(sort).skip(skip).limit(limit).select('-__v -helpfulVotes.userVotes').lean(),
        Review.countDocuments(filter),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      log.info('Reviews fetched successfully for admin', {
        businessEvent: 'ADMIN_REVIEWS_FETCHED',
        count: reviews.length,
        total,
      });

      return {
        data: reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      log.error('Failed to fetch reviews for admin', {
        businessEvent: 'ADMIN_REVIEWS_ERROR',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle product deletion - delete or hide all reviews for a product
   * @param {String} productId - Product ID
   * @param {Boolean} deleteReviews - Whether to delete (true) or hide (false) reviews
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Result with count of affected reviews
   */
  async handleProductDeletion(productId, deleteReviews = true, correlationId) {
    const log = logger.withCorrelationId(correlationId);

    try {
      log.info('Handling product deletion for reviews', {
        productId,
        deleteReviews,
      });

      let result;

      if (deleteReviews) {
        // Permanently delete all reviews for the product
        const deleteResult = await Review.deleteMany({ productId });

        // Clear all related caches
        await Promise.all([
          cacheService.deleteProductReviews(productId, correlationId),
          cacheService.deleteByPattern(`review-service:analytics:product:${productId}*`, correlationId),
        ]);

        result = {
          action: 'deleted',
          count: deleteResult.deletedCount,
        };

        log.info('Reviews deleted for product', {
          productId,
          deletedCount: deleteResult.deletedCount,
        });
      } else {
        // Soft delete: Mark reviews as hidden
        const updateResult = await Review.updateMany(
          { productId },
          {
            $set: {
              status: 'hidden',
              updatedAt: new Date(),
            },
          }
        );

        // Clear product review caches
        await cacheService.deleteProductReviews(productId, correlationId);

        result = {
          action: 'soft_deleted',
          count: updateResult.modifiedCount,
        };

        log.info('Reviews soft deleted for product', {
          productId,
          softDeletedCount: updateResult.modifiedCount,
        });
      }

      return result;
    } catch (error) {
      log.error('Error handling product deletion', {
        productId,
        deleteReviews,
        error: error.message,
      });
      throw error;
    }
  }
}

export default new ReviewService();
