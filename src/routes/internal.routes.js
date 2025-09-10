/**
 * Internal Routes
 * Defines internal/admin API endpoints
 */

import express from 'express';
import { bulkDeleteReviews, getInternalStats } from '../controllers/internal.controller.js';
import { authenticateUser, requireRole } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// All internal routes require authentication and admin role
router.use(authenticateUser);
router.use(requireRole(['admin']));

// Admin/internal operations
router.post(
  '/reviews/bulk-delete',
  rateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 bulk operations per minute
  bulkDeleteReviews
);

router.get(
  '/stats',
  rateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 stats requests per minute
  getInternalStats
);

export default router;
