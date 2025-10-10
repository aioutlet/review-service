/**
 * Moderation Routes
 * Defines moderation-related API endpoints
 */

import express from 'express';
import { approveReview, rejectReview, flagReview } from '../controllers/moderation.controller.js';
import { authenticateUser, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All moderation routes require authentication and moderator role
router.use(authenticateUser);
router.use(requireRole(['moderator', 'admin']));

// Moderation actions
router.post(
  '/reviews/:reviewId/approve',
  approveReview
);

router.post(
  '/reviews/:reviewId/reject',
  rejectReview
);

// Public endpoint for flagging reviews (requires auth but not moderator role)
router.post(
  '/reviews/:reviewId/flag',
  flagReview
);

export default router;
