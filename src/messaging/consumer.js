import logger from '../utils/logger.js';
import reviewService from '../services/review.service.js';
import cacheService from '../services/cache.service.js';
import Review from '../models/review.model.js';
import ProductRating from '../models/productRating.model.js';
import ReviewFlag from '../models/reviewFlag.model.js';

/**
 * Handle order completed event
 * @param {Object} message - Message content
 * @param {String} correlationId - Request correlation ID
 */
export const handleOrderCompleted = async (message, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing order completed event', {
      orderId: message.orderId,
      userId: message.userId,
      productIds: message.productIds,
    });

    const { orderId, userId, productIds, orderDate } = message;

    if (!orderId || !userId || !Array.isArray(productIds)) {
      log.warn('Invalid order completed message format', { message });
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
      message,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};

/**
 * Handle user deleted event
 * @param {Object} message - Message content
 * @param {String} correlationId - Request correlation ID
 */
export const handleUserDeleted = async (message, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing user deleted event', {
      userId: message.userId,
    });

    const { userId, deleteData = true } = message;

    if (!userId) {
      log.warn('Invalid user deleted message format', { message });
      return;
    }

    let deletedReviews = 0;
    let deletedFlags = 0;
    let anonymizedReviews = 0;

    if (deleteData) {
      // Delete all reviews by the user
      const reviewsToDelete = await Review.find({ userId }).select('_id productId');
      const productIds = [...new Set(reviewsToDelete.map((r) => r.productId))];

      const deleteResult = await Review.deleteMany({ userId });
      deletedReviews = deleteResult.deletedCount;

      // Delete review flags created by the user
      const flagDeleteResult = await ReviewFlag.deleteMany({ flaggedBy: userId });
      deletedFlags = flagDeleteResult.deletedCount;

      // Update product ratings for affected products
      for (const productId of productIds) {
        try {
          await reviewService.updateProductRating(productId, correlationId);
          await cacheService.deleteProductReviews(productId, correlationId);
        } catch (error) {
          log.error('Error updating product rating after user deletion:', {
            error: error.message,
            productId,
          });
        }
      }

      // Clear user cache
      await cacheService.deleteUserReviews(userId, correlationId);
    } else {
      // Anonymize user data instead of deleting
      const anonymizeResult = await Review.updateMany(
        { userId },
        {
          $set: {
            username: 'Anonymous User',
            'metadata.updatedAt': new Date(),
          },
          $unset: {
            userId: 1,
          },
        }
      );
      anonymizedReviews = anonymizeResult.modifiedCount;

      // Anonymize flags
      await ReviewFlag.updateMany(
        { flaggedBy: userId },
        {
          $set: {
            flaggedByName: 'Anonymous User',
            'metadata.updatedAt': new Date(),
          },
          $unset: {
            flaggedBy: 1,
          },
        }
      );

      // Clear user cache
      await cacheService.deleteUserReviews(userId, correlationId);
    }

    log.info('User deleted event processed successfully', {
      userId,
      deleteData,
      deletedReviews,
      deletedFlags,
      anonymizedReviews,
    });
  } catch (error) {
    logger.error('Error handling user deleted event:', {
      error: error.message,
      stack: error.stack,
      message,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};

/**
 * Handle product deleted event
 * @param {Object} message - Message content
 * @param {String} correlationId - Request correlation ID
 */
export const handleProductDeleted = async (message, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing product deleted event', {
      productId: message.productId,
    });

    const { productId, deleteReviews = true } = message;

    if (!productId) {
      log.warn('Invalid product deleted message format', { message });
      return;
    }

    let deletedReviews = 0;
    let deletedFlags = 0;
    let deletedRating = false;

    if (deleteReviews) {
      // Get all review IDs for this product
      const reviewIds = await Review.find({ productId }).distinct('_id');

      // Delete all reviews for the product
      const deleteResult = await Review.deleteMany({ productId });
      deletedReviews = deleteResult.deletedCount;

      // Delete all flags for reviews of this product
      if (reviewIds.length > 0) {
        const flagDeleteResult = await ReviewFlag.deleteMany({
          reviewId: { $in: reviewIds },
        });
        deletedFlags = flagDeleteResult.deletedCount;
      }

      // Delete product rating aggregate
      const ratingDeleteResult = await ProductRating.deleteOne({ productId });
      deletedRating = ratingDeleteResult.deletedCount > 0;

      // Clear all caches related to this product
      await Promise.all([
        cacheService.deleteProductRating(productId, correlationId),
        cacheService.deleteProductReviews(productId, correlationId),
        cacheService.deleteByPattern(`review-service:analytics:product:${productId}*`, correlationId),
      ]);

      log.info('Product deleted event processed successfully', {
        productId,
        deletedReviews,
        deletedFlags,
        deletedRating,
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
      await Promise.all([
        cacheService.deleteProductRating(productId, correlationId),
        cacheService.deleteProductReviews(productId, correlationId),
      ]);

      log.info('Product reviews hidden successfully', {
        productId,
        hiddenReviews: updateResult.modifiedCount,
      });
    }
  } catch (error) {
    logger.error('Error handling product deleted event:', {
      error: error.message,
      stack: error.stack,
      message,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};

/**
 * Handle product updated event (for product name changes, etc.)
 * @param {Object} message - Message content
 * @param {String} correlationId - Request correlation ID
 */
export const handleProductUpdated = async (message, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing product updated event', {
      productId: message.productId,
      changes: message.changes,
    });

    const { productId, changes } = message;

    if (!productId || !changes) {
      log.warn('Invalid product updated message format', { message });
      return;
    }

    // Clear product-related caches to ensure fresh data
    await Promise.all([
      cacheService.deleteProductRating(productId, correlationId),
      cacheService.deleteProductReviews(productId, correlationId),
    ]);

    // If product status changed to inactive/discontinued, handle reviews
    if (changes.status && ['inactive', 'discontinued'].includes(changes.status)) {
      await Review.updateMany(
        { productId, status: 'approved' },
        {
          $set: {
            status: 'hidden',
            'metadata.updatedAt': new Date(),
          },
        }
      );
    }

    log.info('Product updated event processed successfully', {
      productId,
      changes,
    });
  } catch (error) {
    logger.error('Error handling product updated event:', {
      error: error.message,
      stack: error.stack,
      message,
      correlationId,
    });
    // Don't re-throw for product updates as they're not critical
  }
};

/**
 * Handle user updated event (for username changes, etc.)
 * @param {Object} message - Message content
 * @param {String} correlationId - Request correlation ID
 */
export const handleUserUpdated = async (message, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing user updated event', {
      userId: message.userId,
      changes: message.changes,
    });

    const { userId, changes } = message;

    if (!userId || !changes) {
      log.warn('Invalid user updated message format', { message });
      return;
    }

    // Update username in reviews if it changed
    if (changes.username) {
      const updateResult = await Review.updateMany(
        { userId },
        {
          $set: {
            username: changes.username,
            'metadata.updatedAt': new Date(),
          },
        }
      );

      log.info('Updated username in reviews', {
        userId,
        newUsername: changes.username,
        modifiedCount: updateResult.modifiedCount,
      });

      // Clear user cache
      await cacheService.deleteUserReviews(userId, correlationId);
    }

    // Handle user status changes
    if (changes.status && ['suspended', 'banned'].includes(changes.status)) {
      await Review.updateMany(
        { userId, status: 'approved' },
        {
          $set: {
            status: 'hidden',
            'metadata.updatedAt': new Date(),
          },
        }
      );

      log.info('Hidden reviews for suspended/banned user', {
        userId,
        status: changes.status,
      });
    } else if (changes.status === 'active') {
      // Restore previously hidden reviews if user is reactivated
      await Review.updateMany(
        { userId, status: 'hidden' },
        {
          $set: {
            status: 'approved',
            'metadata.updatedAt': new Date(),
          },
        }
      );

      log.info('Restored reviews for reactivated user', {
        userId,
      });
    }
  } catch (error) {
    logger.error('Error handling user updated event:', {
      error: error.message,
      stack: error.stack,
      message,
      correlationId,
    });
    // Don't re-throw for user updates as they're not critical
  }
};

/**
 * Generic error handler for consumer methods
 * @param {Error} error - Error object
 * @param {String} eventType - Event type
 * @param {Object} message - Original message
 * @param {String} correlationId - Request correlation ID
 */
export const handleConsumerError = (error, eventType, message, correlationId) => {
  logger.error(`Consumer error for ${eventType}:`, {
    error: error.message,
    stack: error.stack,
    eventType,
    message,
    correlationId,
  });

  // Here you could implement additional error handling logic:
  // - Send to dead letter queue
  // - Alert monitoring systems
  // - Store in error database for manual review
};
