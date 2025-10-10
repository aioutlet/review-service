/**
 * Analytics Routes
 * Defines analytics-related API endpoints
 */

import express from 'express';
import { getProductAnalytics, getTrendingProducts, getReviewTrends } from '../controllers/analytics.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public analytics endpoints (with optional auth for enhanced data)
router.get(
  '/product/:productId',
  optionalAuth,
  getProductAnalytics
);

router.get(
  '/trending',
  optionalAuth,
  getTrendingProducts
);

router.get(
  '/products/:productId/trends',
  optionalAuth,
  getReviewTrends
);

export default router;
