/**
 * Moderation Routes
 * Defines moderation-related API endpoints
 */

import express from 'express';
import { approveReview, rejectReview, flagReview } from '../controllers/moderation.controller.js';
import { authenticateUser, requireRole } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// All moderation routes require authentication and moderator role
router.use(authenticateUser);
router.use(requireRole(['moderator', 'admin']));

// Moderation actions
router.post(
  '/reviews/:reviewId/approve',
  rateLimiter({ windowMs: 60 * 1000, max: 100 }), // 100 approvals per minute
  approveReview
);

router.post(
  '/reviews/:reviewId/reject',
  rateLimiter({ windowMs: 60 * 1000, max: 100 }), // 100 rejections per minute
  rejectReview
);

// Public endpoint for flagging reviews (requires auth but not moderator role)
router.post(
  '/reviews/:reviewId/flag',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 flags per 15 minutes
  flagReview
);

export default router;
