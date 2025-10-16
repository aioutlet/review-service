/**
 * Message Broker Service
 * Handles publishing of domain events for review service
 * Provides abstraction layer between review service and messaging infrastructure
 */

import MessageBrokerFactory from '../messaging/MessageBrokerFactory.js';
import config from '../config/index.js';
import logger from '../observability/index.js';

class MessageBrokerService {
  constructor() {
    this.messageBroker = null;
  }

  /**
   * Get or create message broker instance
   * @returns {IMessageBroker} Message broker instance
   */
  getBroker() {
    if (!this.messageBroker) {
      this.messageBroker = MessageBrokerFactory.create();
    }
    return this.messageBroker;
  }

  /**
   * Initialize message broker if not already connected
   * @returns {Promise<void>}
   */
  async ensureBrokerConnected() {
    const broker = this.getBroker();
    if (!broker.isReady()) {
      await broker.connect();
    }
  }

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
        lastUpdated: new Date().toISOString(),
      },
    };

    return this.publishEvent(config.messaging.exchanges.reviews, 'product.rating.updated', event, correlationId);
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
      await this.ensureBrokerConnected();
      const broker = this.getBroker();

      const options = {
        correlationId,
        headers: {
          correlationId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          publisher: 'review-service',
        },
      };

      const success = await broker.publish(exchange, routingKey, event, options);

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
   * Initialize messaging for API server
   * Call this during API startup
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.ensureBrokerConnected();
      logger.info('✅ Event service initialized');
    } catch (error) {
      logger.error('Failed to initialize event service:', error);
      throw error;
    }
  }

  /**
   * Close messaging connections
   * Call this during API shutdown
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.messageBroker) {
        await this.messageBroker.close();
        this.messageBroker = null;
      }
      logger.info('✅ Event service connections closed');
    } catch (error) {
      logger.error('Error closing event service connections:', error);
      throw error;
    }
  }

  /**
   * Get health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const broker = this.getBroker();
    return {
      connected: broker.isReady(),
      ...broker.getHealthStatus(),
    };
  }
}

// Export singleton instance
export default new MessageBrokerService();
