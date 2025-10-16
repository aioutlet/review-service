import logger from '../../shared/observability/index.js';
import reviewService from '../../shared/services/review.service.js';
import cacheService from '../../shared/services/cache.service.js';
import Review from '../../shared/models/review.model.js';

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

    const { productId, deleteReviews = true } = eventData;

    if (!productId) {
      log.warn('Invalid product deleted message format', { eventData });
      return;
    }

    let deletedReviews = 0;

    if (deleteReviews) {
      // Delete all reviews for the product
      const deleteResult = await Review.deleteMany({ productId });
      deletedReviews = deleteResult.deletedCount;

      // Clear all caches related to this product
      await Promise.all([
        cacheService.deleteProductReviews(productId, correlationId),
        cacheService.deleteByPattern(`review-service:analytics:product:${productId}*`, correlationId),
      ]);

      log.info('Product deleted event processed successfully', {
        productId,
        deletedReviews,
      });
    } else {
      // Just mark reviews as inactive or hide them
      const updateResult = await Review.updateMany(
        { productId },
        {
          $set: {
            status: 'hidden',
            'metadata.updatedAt': new Date(),
          },
        }
      );

      // Clear caches
      await cacheService.deleteProductReviews(productId, correlationId);

      log.info('Product reviews hidden successfully', {
        productId,
        hiddenReviews: updateResult.modifiedCount,
      });
    }
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
