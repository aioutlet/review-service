import logger from '../../shared/observability/index.js';
import reviewService from '../../shared/services/review.service.js';
import cacheService from '../../shared/services/cache.service.js';
import Review from '../../shared/models/review.model.js';
import ReviewFlag from '../../shared/models/reviewFlag.model.js';

/**
 * Handle user deleted event
 * @param {Object} eventData - Event data
 * @param {String} correlationId - Request correlation ID
 */
export const handleUserDeleted = async (eventData, correlationId) => {
  try {
    const log = logger.withCorrelationId(correlationId);

    log.info('Processing user deleted event', {
      userId: eventData.userId,
    });

    const { userId, deleteData = true } = eventData;

    if (!userId) {
      log.warn('Invalid user deleted message format', { eventData });
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
      eventData,
      correlationId,
    });
    throw error; // Re-throw to trigger message redelivery
  }
};
