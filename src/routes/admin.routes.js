import express from 'express';
import { getStats, getAllReviews } from '../controllers/review.controller.js';
import { authenticateUser, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin routes (require admin role)
router.get('/reviews/all', authenticateUser, requireRole(['admin']), getAllReviews);
router.get('/reviews/stats', authenticateUser, requireRole(['admin']), getStats);

export default router;
