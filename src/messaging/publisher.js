import rabbitmqService from './rabbitmq.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class Publisher {
  /**
   * Publish review created event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewCreated(data, correlationId) {
    const event = {
      eventType: 'review.created',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        userId: data.userId,
        rating: data.rating,
        status: data.status,
        isVerifiedPurchase: data.isVerifiedPurchase,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.created', event, correlationId);
  }

  /**
   * Publish review updated event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewUpdated(data, correlationId) {
    const event = {
      eventType: 'review.updated',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        userId: data.userId,
        changes: data.changes,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.updated', event, correlationId);
  }

  /**
   * Publish review deleted event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewDeleted(data, correlationId) {
    const event = {
      eventType: 'review.deleted',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        userId: data.userId,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.deleted', event, correlationId);
  }

  /**
   * Publish review moderated event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewModerated(data, correlationId) {
    const event = {
      eventType: 'review.moderated',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        userId: data.userId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        moderatorId: data.moderatorId,
        moderatorName: data.moderatorName,
        reason: data.reason,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.moderated', event, correlationId);
  }

  /**
   * Publish product rating updated event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishRatingUpdated(data, correlationId) {
    const event = {
      eventType: 'product.rating.updated',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        productId: data.productId,
        averageRating: data.averageRating,
        totalReviews: data.totalReviews,
        ratingDistribution: data.ratingDistribution,
        verifiedPurchaseRating: data.verifiedPurchaseRating,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'product.rating.updated', event, correlationId);
  }

  /**
   * Publish review flagged event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewFlagged(data, correlationId) {
    const event = {
      eventType: 'review.flagged',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        flagId: data.flagId,
        productId: data.productId,
        flaggedBy: data.flaggedBy,
        reason: data.reason,
        priority: data.priority,
        automated: data.automated,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.flagged', event, correlationId);
  }

  /**
   * Publish review flag resolved event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewFlagResolved(data, correlationId) {
    const event = {
      eventType: 'review.flag.resolved',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        flagId: data.flagId,
        productId: data.productId,
        resolution: data.resolution,
        moderatorId: data.moderatorId,
        moderatorName: data.moderatorName,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.flag.resolved', event, correlationId);
  }

  /**
   * Publish review helpfulness voted event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewVoted(data, correlationId) {
    const event = {
      eventType: 'review.voted',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        voterId: data.voterId,
        vote: data.vote,
        helpfulCount: data.helpfulCount,
        notHelpfulCount: data.notHelpfulCount,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.voted', event, correlationId);
  }

  /**
   * Publish review response added event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishReviewResponseAdded(data, correlationId) {
    const event = {
      eventType: 'review.response.added',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        reviewId: data.reviewId,
        productId: data.productId,
        responderId: data.responderId,
        responderType: data.responderType,
        responderName: data.responderName,
        responseLength: data.message?.length || 0,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.response.added', event, correlationId);
  }

  /**
   * Publish analytics event
   * @param {Object} data - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishAnalyticsEvent(data, correlationId) {
    const event = {
      eventType: 'review.analytics',
      timestamp: new Date().toISOString(),
      correlationId,
      data: {
        type: data.type,
        productId: data.productId,
        userId: data.userId,
        metrics: data.metrics,
        timeframe: data.timeframe,
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'review.analytics', event, correlationId);
  }

  /**
   * Generic event publisher
   * @param {String} exchange - Exchange name
   * @param {String} routingKey - Routing key
   * @param {Object} event - Event data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async publishEvent(exchange, routingKey, event, correlationId) {
    try {
      const options = {
        correlationId,
        headers: {
          correlationId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          publisher: 'review-service',
        },
      };

      const success = await rabbitmqService.publish(exchange, routingKey, event, options);

      if (success) {
        logger.info('Event published successfully', {
          eventType: event.eventType,
          exchange,
          routingKey,
          correlationId,
        });
      } else {
        logger.warn('Event publication failed', {
          eventType: event.eventType,
          exchange,
          routingKey,
          correlationId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Error publishing event:', {
        error: error.message,
        eventType: event.eventType,
        exchange,
        routingKey,
        correlationId,
      });
      return false;
    }
  }

  /**
   * Publish batch events
   * @param {Array} events - Array of events to publish
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Results summary
   */
  async publishBatch(events, correlationId) {
    const results = {
      total: events.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const event of events) {
      try {
        const success = await this.publishEvent(event.exchange, event.routingKey, event.data, correlationId);

        if (success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            event: event.data.eventType,
            error: 'Publication returned false',
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          event: event.data.eventType,
          error: error.message,
        });
      }
    }

    logger.info('Batch event publication completed', {
      ...results,
      correlationId,
    });

    return results;
  }

  /**
   * Get publisher health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      connected: rabbitmqService.isReady(),
      ...rabbitmqService.getHealthStatus(),
    };
  }
}

export default new Publisher();
