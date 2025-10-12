import logger from '../../common/observability/index.js';
import reviewService from '../../shared/services/review.service.js';
import cacheService from '../../shared/services/cache.service.js';
import Review from '../../shared/models/review.model.js';

/**
 * Handle order completed event
 * @param {Object} eventData - Event data
 * @param {String} correlationId - Request correlation ID
 */
export const handleOrderCompleted = async (eventData, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing order completed event', {
      orderId: eventData.orderId,
      userId: eventData.userId,
      productIds: eventData.productIds,
    });

    const { orderId, userId, productIds, orderDate } = eventData;

    if (!orderId || !userId || !Array.isArray(productIds)) {
      log.warn('Invalid order completed message format', { eventData });
      return;
    }

    // Update existing reviews to mark as verified purchase
    for (const productId of productIds) {
      try {
        const result = await Review.updateMany(
          {
            productId,
            userId,
            isVerifiedPurchase: false,
          },
          {
            $set: {
              isVerifiedPurchase: true,
              orderReference: orderId,
              'metadata.updatedAt': new Date(),
            },
          }
        );

        if (result.modifiedCount > 0) {
          log.info('Updated reviews to verified purchase', {
            productId,
            userId,
            modifiedCount: result.modifiedCount,
          });

          // Update product rating to reflect verified purchase changes
          await reviewService.updateProductRating(productId, correlationId);

          // Clear cached reviews for this product
          await cacheService.deleteProductReviews(productId, correlationId);
        }
      } catch (error) {
        log.error('Error updating review to verified purchase:', {
          error: error.message,
          productId,
          userId,
          orderId,
        });
      }
    }

    log.info('Order completed event processed successfully', {
      orderId,
      userId,
      productsProcessed: productIds.length,
    });
  } catch (error) {
    logger.error('Error handling order completed event:', {
      error: error.message,
      stack: error.stack,
      eventData,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};
