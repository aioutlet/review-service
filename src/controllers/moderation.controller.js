/**
 * Moderation Controller
 * Handles review moderation actions (approve, reject, flag, etc.)
 */

import reviewService from '../services/review.service.js';
import logger from '../utils/logger.js';
import { createOperationSpan } from '../observability/tracing/helpers.js';

/**
 * Approve a review
 */
export const approveReview = async (req, res) => {
  const span = createOperationSpan('controller.moderation.approve', {
    'review.id': req.params.reviewId,
    'moderator.id': req.user?.id,
  });
  const startTime = logger.operationStart('approveReview', req);
  try {
    const { reviewId } = req.params;
    const result = await reviewService.approveReview(reviewId, req.user, req.correlationId);
    span.setStatus(1);
    logger.operationComplete('approveReview', startTime, req, { reviewId });
    res.status(200).json({ success: true, message: 'Review approved', data: result });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('approveReview', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'MODERATION_ERROR' });
  } finally {
    span.end();
  }
};

/**
 * Reject a review
 */
export const rejectReview = async (req, res) => {
  const span = createOperationSpan('controller.moderation.reject', {
    'review.id': req.params.reviewId,
    'moderator.id': req.user?.id,
  });
  const startTime = logger.operationStart('rejectReview', req);
  try {
    const { reviewId } = req.params;
    const result = await reviewService.rejectReview(reviewId, req.user, req.correlationId);
    span.setStatus(1);
    logger.operationComplete('rejectReview', startTime, req, { reviewId });
    res.status(200).json({ success: true, message: 'Review rejected', data: result });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('rejectReview', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'MODERATION_ERROR' });
  } finally {
    span.end();
  }
};

/**
 * Flag a review for moderation
 */
export const flagReview = async (req, res) => {
  const span = createOperationSpan('controller.moderation.flag', {
    'review.id': req.params.reviewId,
    'user.id': req.user?.id,
  });
  const startTime = logger.operationStart('flagReview', req);
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const result = await reviewService.flagReview(reviewId, reason, req.user, req.correlationId);
    span.setStatus(1);
    logger.operationComplete('flagReview', startTime, req, { reviewId, reason });
    res.status(200).json({ success: true, message: 'Review flagged', data: result });
  } catch (error) {
    span.setStatus(2, error.message);
    logger.operationFailed('flagReview', startTime, error, req);
    res.status(500).json({ success: false, message: error.message, code: error.code || 'MODERATION_ERROR' });
  } finally {
    span.end();
  }
};
