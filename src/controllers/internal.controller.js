/**
 * Internal Controller
 * Handles internal endpoints for admin/ops/maintenance
 */

import reviewService from '../services/review.service.js';
import logger from '../observability/index.js';
import { createOperationSpan } from '../observability/tracing/helpers.js';

/**
 * Bulk delete reviews (admin only)
 */
export const bulkDeleteReviews = async (req, res) => {
  const span = createOperationSpan('controller.internal.bulk_delete', {
    'admin.id': req.user?.id,
  });
  const startTime = logger.operationStart('bulkDeleteReviews', req);
  try {
    const { reviewIds } = req.body;
    const result = await reviewService.bulkDeleteReviews(reviewIds, req.user, req.correlationId);
    span.setStatus(1);
    logger.operationComplete('bulkDeleteReviews', startTime, req, { count: result.deletedCount });
    res.status(200).json({ success: true, message: 'Bulk delete successful', data: result });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('bulkDeleteReviews', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'INTERNAL_ERROR' });
  } finally {
    span.end();
  }
};

/**
 * Get internal review stats (admin only)
 */
export const getInternalStats = async (req, res) => {
  const span = createOperationSpan('controller.internal.stats', {
    'admin.id': req.user?.id,
  });
  const startTime = logger.operationStart('getInternalStats', req);
  try {
    const stats = await reviewService.getInternalStats(req.correlationId);
    span.setStatus(1);
    logger.operationComplete('getInternalStats', startTime, req);
    res.status(200).json({ success: true, message: 'Internal stats retrieved', data: stats });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('getInternalStats', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'INTERNAL_ERROR' });
  } finally {
    span.end();
  }
};
