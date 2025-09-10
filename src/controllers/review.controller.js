/**
 * Review Controller
 * Handles all review-related HTTP requests
 */

import reviewService from '../services/review.service.js';
import logger from '../utils/logger.js';
import { createOperationSpan } from '../observability/tracing/helpers.js';
import {
  validateCreateReview,
  validateUpdateReview,
  validateReviewVote,
  validateRating,
} from '../validators/review.validator.js';

class ReviewController {
  /**
   * Create a new review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createReview(req, res) {
    const span = createOperationSpan('controller.create_review', {
      'user.id': req.user?.id,
      'product.id': req.body?.productId,
    });

    const startTime = logger.operationStart('createReview', req);

    try {
      // Validate request data
      const validation = await validateCreateReview(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          code: 'VALIDATION_ERROR',
        });
      }

      // Create review using service
      const review = await reviewService.createReview(validation.data, req.user, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('review_created', {
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
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('createReview', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'REVIEW_CREATION_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get reviews for a product
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProductReviews(req, res) {
    const span = createOperationSpan('controller.get_product_reviews', {
      'product.id': req.params.productId,
    });

    const startTime = logger.operationStart('getProductReviews', req);

    try {
      const { productId } = req.params;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'metadata.createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        status: req.query.status || 'approved',
        rating: req.query.rating ? req.query.rating.split(',').map(Number) : undefined,
        verifiedOnly: req.query.verifiedOnly === 'true',
        withMedia: req.query.withMedia === 'true',
        search: req.query.search,
        userId: req.query.userId,
      };

      const result = await reviewService.getProductReviews(productId, options, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('reviews_retrieved', {
        'reviews.count': result.reviews.length,
        'reviews.total': result.pagination.total,
      });

      logger.operationComplete('getProductReviews', startTime, req, {
        productId,
        reviewsCount: result.reviews.length,
        totalReviews: result.pagination.total,
      });

      res.status(200).json({
        success: true,
        message: 'Reviews retrieved successfully',
        data: result,
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('getProductReviews', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'REVIEW_RETRIEVAL_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get a specific review by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getReviewById(req, res) {
    const span = createOperationSpan('controller.get_review_by_id', {
      'review.id': req.params.reviewId,
    });

    const startTime = logger.operationStart('getReviewById', req);

    try {
      const { reviewId } = req.params;
      const userId = req.user?.id || null;

      const review = await reviewService.getReviewById(reviewId, userId, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('review_retrieved', {
        'review.id': review._id.toString(),
        'review.status': review.status,
      });

      logger.operationComplete('getReviewById', startTime, req, {
        reviewId: review._id,
      });

      res.status(200).json({
        success: true,
        message: 'Review retrieved successfully',
        data: {
          review,
        },
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('getReviewById', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'REVIEW_RETRIEVAL_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Update a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateReview(req, res) {
    const span = createOperationSpan('controller.update_review', {
      'review.id': req.params.reviewId,
      'user.id': req.user?.id,
    });

    const startTime = logger.operationStart('updateReview', req);

    try {
      const { reviewId } = req.params;

      // Validate request data
      const validation = await validateUpdateReview(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          code: 'VALIDATION_ERROR',
        });
      }

      const updatedReview = await reviewService.updateReview(reviewId, validation.data, req.user, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('review_updated', {
        'review.id': updatedReview._id.toString(),
        'review.status': updatedReview.status,
      });

      logger.operationComplete('updateReview', startTime, req, {
        reviewId: updatedReview._id,
      });

      res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: {
          review: updatedReview,
        },
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('updateReview', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'REVIEW_UPDATE_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Delete a review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteReview(req, res) {
    const span = createOperationSpan('controller.delete_review', {
      'review.id': req.params.reviewId,
      'user.id': req.user?.id,
    });

    const startTime = logger.operationStart('deleteReview', req);

    try {
      const { reviewId } = req.params;

      await reviewService.deleteReview(reviewId, req.user, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('review_deleted', {
        'review.id': reviewId,
      });

      logger.operationComplete('deleteReview', startTime, req, {
        reviewId,
      });

      res.status(200).json({
        success: true,
        message: 'Review deleted successfully',
        data: {
          reviewId,
        },
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('deleteReview', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'REVIEW_DELETION_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Vote on review helpfulness
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async voteReviewHelpfulness(req, res) {
    const span = createOperationSpan('controller.vote_review_helpfulness', {
      'review.id': req.params.reviewId,
      'user.id': req.user?.id,
      'vote.type': req.body?.vote,
    });

    const startTime = logger.operationStart('voteReviewHelpfulness', req);

    try {
      const { reviewId } = req.params;

      // Validate vote data
      const validation = await validateReviewVote(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          code: 'VALIDATION_ERROR',
        });
      }

      const result = await reviewService.voteReviewHelpfulness(
        reviewId,
        req.user.id,
        validation.data.vote,
        req.correlationId
      );

      span.setStatus(1); // OK
      span.addEvent('review_vote_cast', {
        'review.id': reviewId,
        'vote.type': validation.data.vote,
      });

      logger.operationComplete('voteReviewHelpfulness', startTime, req, {
        reviewId,
        vote: validation.data.vote,
      });

      res.status(200).json({
        success: true,
        message: 'Vote recorded successfully',
        data: result,
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('voteReviewHelpfulness', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'VOTE_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get user's reviews
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserReviews(req, res) {
    const span = createOperationSpan('controller.get_user_reviews', {
      'user.id': req.user?.id,
    });

    const startTime = logger.operationStart('getUserReviews', req);

    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'metadata.createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        status: req.query.status,
        productId: req.query.productId,
      };

      const result = await reviewService.getUserReviews(req.user.id, options, req.correlationId);

      span.setStatus(1); // OK
      span.addEvent('user_reviews_retrieved', {
        'reviews.count': result.reviews.length,
        'reviews.total': result.pagination.total,
      });

      logger.operationComplete('getUserReviews', startTime, req, {
        userId: req.user.id,
        reviewsCount: result.reviews.length,
      });

      res.status(200).json({
        success: true,
        message: 'User reviews retrieved successfully',
        data: result,
      });
    } catch (error) {
      span.setStatus(2, error.message); // ERROR
      logger.operationFailed('getUserReviews', startTime, error, req);

      const statusCode = this.getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code || 'USER_REVIEWS_ERROR',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get error status code based on error type
   * @param {Error} error - Error object
   * @returns {number} HTTP status code
   */
  getErrorStatusCode(error) {
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'UnauthorizedError') return 401;
    return 500;
  }
}

export default new ReviewController();
