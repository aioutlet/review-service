/**
 * Analytics Controller
 * Handles review analytics endpoints (ratings, stats, trends, etc.)
 */

import reviewService from '../services/review.service.js';
import logger from '../utils/logger.js';
import { createOperationSpan } from '../observability/tracing/helpers.js';

class AnalyticsController {
  /**
   * Get product review analytics (average rating, count, breakdown)
   */
  async getProductAnalytics(req, res) {
    const span = createOperationSpan('controller.analytics.product', {
      'product.id': req.params.productId,
    });
    const startTime = logger.operationStart('getProductAnalytics', req);
    try {
      const { productId } = req.params;
      const analytics = await reviewService.getProductAnalytics(productId, req.correlationId);
      span.setStatus(1);
      logger.operationComplete('getProductAnalytics', startTime, req, { productId });
      res.status(200).json({ success: true, message: 'Product analytics retrieved', data: analytics });
    } catch (error) {
      span.setStatus(2, error.message);
      logger.operationFailed('getProductAnalytics', startTime, error, req);
      res.status(500).json({ success: false, message: error.message, code: error.code || 'ANALYTICS_ERROR' });
    } finally {
      span.end();
    }
  }

  /**
   * Get review trends (time series, etc.)
   */
  async getReviewTrends(req, res) {
    const span = createOperationSpan('controller.analytics.trends', {
      'product.id': req.params.productId,
    });
    const startTime = logger.operationStart('getReviewTrends', req);
    try {
      const { productId } = req.params;
      const trends = await reviewService.getReviewTrends(productId, req.correlationId);
      span.setStatus(1);
      logger.operationComplete('getReviewTrends', startTime, req, { productId });
      res.status(200).json({ success: true, message: 'Review trends retrieved', data: trends });
    } catch (error) {
      span.setStatus(2, error.message);
      logger.operationFailed('getReviewTrends', startTime, error, req);
      res.status(500).json({ success: false, message: error.message, code: error.code || 'ANALYTICS_ERROR' });
    } finally {
      span.end();
    }
  }
}

export default new AnalyticsController();
