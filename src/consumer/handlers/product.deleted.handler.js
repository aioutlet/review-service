import logger from '../../shared/observability/index.js';
import reviewService from '../../shared/services/review.service.js';

/**
 * Handle product deleted event
 * @param {Object} eventData - Event data
 * @param {String} correlationId - Request correlation ID
 */
export const handleProductDeleted = async (eventData, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing product deleted event', {
      productId: eventData.productId,
    });

    const { productId, hardDelete = false } = eventData;

    if (!productId) {
      log.warn('Invalid product deleted message format', { eventData });
      return;
    }

    // Delegate to service layer for business logic
    // By default, soft delete (isActive=false) unless hardDelete is explicitly true
    const result = await reviewService.handleProductDeletion(productId, hardDelete, correlationId);

    log.info('Product deleted event processed successfully', {
      productId,
      action: result.action,
      affectedReviews: result.count,
    });
  } catch (error) {
    logger.error('Error handling product deleted event:', {
      error: error.message,
      stack: error.stack,
      eventData,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};
