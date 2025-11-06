import express from 'express';
import {
  getProductReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  voteOnReview,
  getUserReviews,
  getInternalStats,
  getAllReviews,
} from '../controllers/review.controller.js';
import { authenticateUser, optionalAuth, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (with optional authentication for personalization)
router.get('/product/:productId', optionalAuth, getProductReviews);
router.get('/:reviewId', optionalAuth, getReviewById);

// Protected routes (require authentication)
router.post('/', authenticateUser, createReview);
router.put('/:reviewId', authenticateUser, updateReview);
router.delete('/:reviewId', authenticateUser, deleteReview);
router.post('/:reviewId/vote', authenticateUser, voteOnReview);
router.get('/user/my-reviews', authenticateUser, getUserReviews);

// Admin routes (require admin role)
router.get('/admin/all', authenticateUser, requireRole(['admin']), getAllReviews);
router.get('/admin/stats', authenticateUser, requireRole(['admin']), getInternalStats);

export default router;
