import reviewService from '../services/review.service.js';
import { logger } from '../core/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';

/**
 * Create a new review
 */
export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.body, req.user, req.correlationId);
  res.status(201).json({
    success: true,
    message: 'Review created successfully',
    data: { review },
  });
});

/**
 * Get reviews for a specific product
 */
export const getProductReviews = asyncHandler(async (req, res) => {
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

  res.status(200).json({
    success: true,
    message: 'Reviews retrieved successfully',
    data: result,
  });
});

/**
 * Get a specific review by ID
 */
export const getReviewById = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId || null;
  const review = await reviewService.getReviewById(reviewId, userId, req.correlationId);

  res.status(200).json({
    success: true,
    message: 'Review retrieved successfully',
    data: { review },
  });
});

/**
 * Update a review
 */
export const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const review = await reviewService.updateReview(reviewId, req.user.userId, req.body, req.correlationId);
  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: { review },
  });
});

/**
 * Delete a review
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  await reviewService.deleteReview(reviewId, req.user.userId, req.correlationId);
  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

/**
 * Vote on review helpfulness
 */
export const voteOnReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { voteType } = req.body;
  const result = await reviewService.voteOnReview(reviewId, req.user.userId, voteType, req.correlationId);

  res.status(200).json({
    success: true,
    message: 'Vote recorded successfully',
    data: result,
  });
});

/**
 * Get user's own reviews
 */
export const getUserReviews = asyncHandler(async (req, res) => {
  const queryOptions = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    sort: req.query.sort || 'newest',
    status: req.query.status || null,
  };

  const result = await reviewService.getUserReviews(req.user.userId, queryOptions, req.correlationId);

  res.status(200).json({
    success: true,
    message: 'User reviews retrieved successfully',
    data: result,
  });
});

/**
 * Get internal review stats (admin only)
 */
export const getInternalStats = asyncHandler(async (req, res) => {
  const stats = await reviewService.getInternalStats(req.correlationId);

  res.status(200).json({
    success: true,
    message: 'Internal stats retrieved',
    data: stats,
  });
});

/**
 * Get all reviews (admin only)
 */
export const getAllReviews = asyncHandler(async (req, res) => {
  const { status, rating, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const reviews = await reviewService.getAllReviewsForAdmin(
    {
      status,
      rating: rating ? parseInt(rating) : undefined,
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
    },
    req.correlationId
  );

  res.status(200).json({
    success: true,
    data: reviews.data,
    pagination: reviews.pagination,
  });
});
