/**
 * Review Controller
 * Handles all review-related HTTP requests
 */

import reviewService from '../../shared/services/review.service.js';
import logger from '../../shared/observability/index.js';
import { createOperationSpan } from '../../shared/observability/tracing/helpers.js';
import ProductRating from '../../shared/models/productRating.model.js';
import mongoose from 'mongoose';

/**
 * Get error status code based on error type
 * @param {Error} error - Error object
 * @returns {number} HTTP status code
 */
const getErrorStatusCode = (error) => {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'ConflictError') return 409;
  if (error.name === 'ForbiddenError') return 403;
  if (error.name === 'UnauthorizedError') return 401;
  return 500;
};

/**
 * Create a new review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createReview = async (req, res) => {
  const span = createOperationSpan('controller.review.create', {
    'user.id': req.user?.userId,
    'product.id': req.body.productId,
  });

  const startTime = logger.operationStart('createReview', req);

  try {
    const reviewData = {
      ...req.body,
      userId: req.user.userId,
    };

    const review = await reviewService.createReview(reviewData, req.correlationId);

    span.setAttributes({
      'review.id': review._id.toString(),
      'review.status': review.status,
    });

    logger.operationComplete('createReview', startTime, req, {
      reviewId: review._id,
      status: review.status,
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: {
        review,
      },
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('createReview', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'REVIEW_CREATION_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Get reviews for a specific product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProductReviews = async (req, res) => {
  const span = createOperationSpan('controller.review.getProductReviews', {
    'product.id': req.params.productId,
  });

  const startTime = logger.operationStart('getProductReviews', req);

  try {
    const { productId } = req.params;
    const queryOptions = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sort: req.query.sort || 'newest',
      rating: req.query.rating ? parseInt(req.query.rating) : null,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : null,
      search: req.query.search || null,
    };

    const result = await reviewService.getProductReviews(productId, queryOptions, req.correlationId);

    span.setAttributes({
      'reviews.count': result.reviews.length,
      'pagination.page': result.pagination.page,
      'pagination.totalPages': result.pagination.totalPages,
    });

    logger.operationComplete('getProductReviews', startTime, req, {
      productId,
      reviewCount: result.reviews.length,
      page: result.pagination.page,
    });

    res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: result,
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getProductReviews', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'REVIEW_RETRIEVAL_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Get a specific review by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getReviewById = async (req, res) => {
  const span = createOperationSpan('controller.review.getById', {
    'review.id': req.params.reviewId,
  });

  const startTime = logger.operationStart('getReviewById', req);

  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId || null;

    const review = await reviewService.getReviewById(reviewId, userId, req.correlationId);

    span.setAttributes({
      'review.found': !!review,
      'review.status': review?.status,
    });

    logger.operationComplete('getReviewById', startTime, req, {
      reviewId,
      found: !!review,
    });

    res.status(200).json({
      success: true,
      message: 'Review retrieved successfully',
      data: {
        review,
      },
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getReviewById', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'REVIEW_RETRIEVAL_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Update a review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateReview = async (req, res) => {
  const span = createOperationSpan('controller.review.update', {
    'review.id': req.params.reviewId,
    'user.id': req.user.userId,
  });

  const startTime = logger.operationStart('updateReview', req);

  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const review = await reviewService.updateReview(reviewId, userId, updateData, req.correlationId);

    span.setAttributes({
      'review.status': review.status,
      'review.updated': true,
    });

    logger.operationComplete('updateReview', startTime, req, {
      reviewId,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review,
      },
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('updateReview', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'REVIEW_UPDATE_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Delete a review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteReview = async (req, res) => {
  const span = createOperationSpan('controller.review.delete', {
    'review.id': req.params.reviewId,
    'user.id': req.user.userId,
  });

  const startTime = logger.operationStart('deleteReview', req);

  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    await reviewService.deleteReview(reviewId, userId, req.correlationId);

    span.setAttributes({
      'review.deleted': true,
    });

    logger.operationComplete('deleteReview', startTime, req, {
      reviewId,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('deleteReview', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'REVIEW_DELETION_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Vote on review helpfulness
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const voteOnReview = async (req, res) => {
  const span = createOperationSpan('controller.review.vote', {
    'review.id': req.params.reviewId,
    'user.id': req.user.userId,
    'vote.type': req.body.voteType,
  });

  const startTime = logger.operationStart('voteOnReview', req);

  try {
    const { reviewId } = req.params;
    const { voteType } = req.body;
    const userId = req.user.userId;

    const result = await reviewService.voteOnReview(reviewId, userId, voteType, req.correlationId);

    span.setAttributes({
      'vote.recorded': true,
      'vote.type': voteType,
    });

    logger.operationComplete('voteOnReview', startTime, req, {
      reviewId,
      userId,
      voteType,
    });

    res.status(200).json({
      success: true,
      message: 'Vote recorded successfully',
      data: result,
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('voteOnReview', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'VOTE_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Get user's own reviews
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserReviews = async (req, res) => {
  const span = createOperationSpan('controller.review.getUserReviews', {
    'user.id': req.user.userId,
  });

  const startTime = logger.operationStart('getUserReviews', req);

  try {
    const userId = req.user.userId;
    const queryOptions = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sort: req.query.sort || 'newest',
      status: req.query.status || null,
    };

    const result = await reviewService.getUserReviews(userId, queryOptions, req.correlationId);

    span.setAttributes({
      'reviews.count': result.reviews.length,
      'pagination.page': result.pagination.page,
      'pagination.totalPages': result.pagination.totalPages,
    });

    logger.operationComplete('getUserReviews', startTime, req, {
      userId,
      reviewCount: result.reviews.length,
      page: result.pagination.page,
    });

    res.status(200).json({
      success: true,
      message: 'User reviews retrieved successfully',
      data: result,
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getUserReviews', startTime, error, req);

    const statusCode = getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'USER_REVIEWS_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Get product rating aggregate (fast path using product_ratings collection)
 */
export const getProductRating = async (req, res) => {
  const span = createOperationSpan('controller.review.product_rating', {
    'product.id': req.params.productId,
  });
  const startTime = logger.operationStart('getProductRating', req);
  try {
    const { productId } = req.params;

    // Fast lookup from product_ratings collection
    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(productId);
    } catch (error) {
      // If conversion fails, keep original string ID
      objectId = productId;
    }

    let rating = await ProductRating.findOne({ productId: objectId }).lean();

    if (!rating) {
      // Fallback: calculate and store rating if not exists
      rating = await reviewService.updateProductRating(productId, req.correlationId);
    }

    span.setStatus(1);
    logger.operationComplete('getProductRating', startTime, req, { productId });
    res.status(200).json({
      success: true,
      message: 'Product rating retrieved',
      data: rating,
    });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getProductRating', startTime, error, req);
    res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || 'PRODUCT_RATING_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Get product ratings for multiple products (batch operation)
 */
export const getProductRatingsBatch = async (req, res) => {
  const span = createOperationSpan('controller.review.product_ratings_batch', {
    'products.count': req.body?.productIds?.length || 0,
  });
  const startTime = logger.operationStart('getProductRatingsBatch', req);

  console.log('[ReviewController] === BATCH RATINGS REQUEST ===');
  console.log('[ReviewController] Request method:', req.method);
  console.log('[ReviewController] Request URL:', req.url);
  console.log('[ReviewController] Request body:', JSON.stringify(req.body, null, 2));
  console.log('[ReviewController] Request headers:', JSON.stringify(req.headers, null, 2));

  try {
    const { productIds } = req.body;
    console.log('[ReviewController] Extracted productIds:', productIds);

    if (!Array.isArray(productIds) || productIds.length === 0) {
      console.log('[ReviewController] Invalid productIds - not array or empty');
      return res.status(400).json({
        success: false,
        message: 'productIds array is required',
      });
    }

    if (productIds.length > 100) {
      console.log('[ReviewController] Too many productIds:', productIds.length);
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 products per batch request',
      });
    }

    // Fast batch lookup from product_ratings collection
    // Convert string IDs to ObjectIds for MongoDB query
    console.log('[ReviewController] Converting productIds to ObjectIds...');
    const objectIds = productIds.map((id) => {
      try {
        const objectId = new mongoose.Types.ObjectId(id);
        console.log(`[ReviewController] Converted ${id} -> ${objectId}`);
        return objectId;
      } catch (error) {
        console.log(`[ReviewController] Failed to convert ${id} to ObjectId:`, error.message);
        // If conversion fails, keep original string ID
        return id;
      }
    });
    console.log('[ReviewController] Final objectIds for query:', objectIds);

    console.log('[ReviewController] Querying ProductRating collection...');
    const ratings = await ProductRating.find({
      productId: { $in: objectIds },
    }).lean();
    console.log('[ReviewController] Found ratings from database:', JSON.stringify(ratings, null, 2));

    // Create a map for quick lookup
    // Convert ObjectId productIds back to strings for mapping
    console.log('[ReviewController] Creating rating map...');
    const ratingMap = ratings.reduce((acc, rating) => {
      const productIdString = rating.productId.toString();
      console.log(`[ReviewController] Mapping ${productIdString} ->`, {
        averageRating: rating.averageRating,
        totalReviews: rating.totalReviews,
      });
      acc[productIdString] = rating;
      return acc;
    }, {});
    console.log('[ReviewController] Final ratingMap:', Object.keys(ratingMap));

    // Fill in missing ratings with defaults
    console.log('[ReviewController] Building final result array...');
    const result = productIds.map((productId) => {
      const foundRating = ratingMap[productId];
      const finalRating = foundRating || {
        productId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedPurchaseRating: null,
        verifiedReviewsCount: 0,
        lastUpdated: new Date(),
      };
      console.log(`[ReviewController] Final rating for ${productId}:`, {
        averageRating: finalRating.averageRating,
        totalReviews: finalRating.totalReviews,
      });
      return finalRating;
    });

    console.log('[ReviewController] === FINAL RESULT ===');
    console.log('[ReviewController] Returning result:', JSON.stringify(result, null, 2));

    span.setStatus(1);
    logger.operationComplete('getProductRatingsBatch', startTime, req, {
      requestedCount: productIds.length,
      foundCount: ratings.length,
    });

    const responseData = {
      success: true,
      message: 'Product ratings retrieved',
      data: result,
    };
    console.log('[ReviewController] Sending response:', JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
  } catch (error) {
    console.error('[ReviewController] ERROR in getProductRatingsBatch:', error);
    span.setStatus(2, error.message);
    logger.operationFailed('getProductRatingsBatch', startTime, error, req);
    res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || 'BATCH_RATING_ERROR',
    });
  } finally {
    span.end();
  }
};

/**
 * Bulk delete reviews (admin only)
 */
export const bulkDeleteReviews = async (req, res) => {
  const span = createOperationSpan('controller.review.bulk_delete', {
    'admin.id': req.user?.id,
  });
  const startTime = logger.operationStart('bulkDeleteReviews', req);
  try {
    const { reviewIds } = req.body;
    const result = await reviewService.bulkDeleteReviews(reviewIds, req.user, req.correlationId);
    span.setStatus(1);
    logger.operationComplete('bulkDeleteReviews', startTime, req, { count: result.deletedCount });
    res.status(200).json({ success: true, message: 'Bulk delete successful', data: result });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('bulkDeleteReviews', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'BULK_DELETE_ERROR' });
  } finally {
    span.end();
  }
};

/**
 * Get internal review stats (admin only)
 */
export const getInternalStats = async (req, res) => {
  const span = createOperationSpan('controller.review.internal_stats', {
    'admin.id': req.user?.id,
  });
  const startTime = logger.operationStart('getInternalStats', req);
  try {
    const stats = await reviewService.getInternalStats(req.correlationId);
    span.setStatus(1);
    logger.operationComplete('getInternalStats', startTime, req);
    res.status(200).json({ success: true, message: 'Internal stats retrieved', data: stats });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getInternalStats', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'STATS_ERROR' });
  } finally {
    span.end();
  }
};
