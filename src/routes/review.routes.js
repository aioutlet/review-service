/**
 * Review Routes
 * Defines all review-related API endpoints
 */

import express from 'express';
import reviewController from '../controllers/review.controller.js';
import { authenticateUser, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Public routes (with optional authentication for personalization)
router.get('/product/:productId', optionalAuth, reviewController.getProductReviews);
router.get('/:reviewId', optionalAuth, reviewController.getReviewById);

// Protected routes (require authentication)
router.post(
  '/',
  authenticateUser,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 reviews per 15 minutes
  reviewController.createReview
);

router.put('/:reviewId', authenticateUser, reviewController.updateReview);

router.delete('/:reviewId', authenticateUser, reviewController.deleteReview);

router.post(
  '/:reviewId/vote',
  authenticateUser,
  rateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 votes per minute
  reviewController.voteReviewHelpfulness
);

router.get('/user/my-reviews', authenticateUser, reviewController.getUserReviews);

export default router;
