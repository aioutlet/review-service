/**
 * Analytics Routes
 * Defines analytics-related API endpoints
 */

import express from 'express';
import { getProductAnalytics, getTrendingProducts, getReviewTrends } from '../controllers/analytics.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Public analytics endpoints (with optional auth for enhanced data)
router.get(
  '/product/:productId',
  optionalAuth,
  rateLimiter({ windowMs: 60 * 1000, max: 50 }), // 50 requests per minute
  getProductAnalytics
);

router.get(
  '/trending',
  optionalAuth,
  rateLimiter({ windowMs: 60 * 1000, max: 30 }), // 30 requests per minute
  getTrendingProducts
);

router.get(
  '/products/:productId/trends',
  optionalAuth,
  rateLimiter({ windowMs: 60 * 1000, max: 30 }), // 30 requests per minute
  getReviewTrends
);

export default router;
