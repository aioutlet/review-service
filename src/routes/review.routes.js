/**
 * Review Routes
 * Defines all review-related API endpoints
 */

import express from 'express';
import {
  getProductReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  voteOnReview,
  getUserReviews,
} from '../controllers/review.controller.js';
import { authenticateUser, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Public routes (with optional authentication for personalization)
router.get('/product/:productId', optionalAuth, getProductReviews);
router.get('/:reviewId', optionalAuth, getReviewById);

// Protected routes (require authentication)
router.post(
  '/',
  authenticateUser,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 reviews per 15 minutes
  createReview
);

router.put('/:reviewId', authenticateUser, updateReview);

router.delete('/:reviewId', authenticateUser, deleteReview);

router.post(
  '/:reviewId/vote',
  authenticateUser,
  rateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 votes per minute
  voteOnReview
);

router.get('/user/my-reviews', authenticateUser, getUserReviews);

export default router;
