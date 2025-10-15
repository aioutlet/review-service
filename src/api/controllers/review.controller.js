/**
 * Review Controller
 * Handles all review-related HTTP requests
 */

import reviewService from '../../shared/services/review.service.js';
import logger from '../../shared/observability/index.js';
import { createOperationSpan } from '../../shared/observability/tracing/helpers.js';

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
