/**
 * Internal Routes
 * Defines internal/admin API endpoints
 */

import express from 'express';
import { bulkDeleteReviews, getInternalStats } from '../controllers/internal.controller.js';
import { authenticateUser, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All internal routes require authentication and admin role
router.use(authenticateUser);
router.use(requireRole(['admin']));

// Admin/internal operations
router.post(
  '/reviews/bulk-delete',
  bulkDeleteReviews
);

router.get(
  '/stats',
  getInternalStats
);

export default router;
