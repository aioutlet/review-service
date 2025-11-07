/**
 * Dapr Event Publisher for Review Service
 * Publishes events via Dapr pub/sub component
 */

import { DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import config from '../core/config.js';
import { logger } from '../core/logger.js';

class DaprEventPublisher {
  constructor() {
    this.serviceName = config.serviceName;
    this.pubsubName = process.env.DAPR_PUBSUB_NAME || 'review-pubsub';
    this.daprHost = process.env.DAPR_HOST || '127.0.0.1';
    this.daprPort = process.env.DAPR_HTTP_PORT || '3500';
    this.client = null;
  }

  /**
   * Initialize Dapr client
   */
  initialize() {
    this.client = new DaprClient({
      daprHost: this.daprHost,
      daprPort: this.daprPort,
      communicationProtocol: CommunicationProtocolEnum.HTTP,
    });
    logger.info('Dapr Event Publisher initialized', {
      pubsubName: this.pubsubName,
      daprHost: this.daprHost,
      daprPort: this.daprPort,
    });
  }

  /**
   * Publish an event via Dapr pub/sub
   */
  async publishEvent(topic, eventType, data, correlationId = null) {
    if (!this.client) {
      logger.warn('Dapr client not initialized. Skipping event publish.', {
        eventType,
        topic,
      });
      return false;
    }

    const cloudEvent = {
      specversion: '1.0',
      type: eventType,
      source: this.serviceName,
      id: correlationId || `${eventType}-${Date.now()}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        correlationId: correlationId || undefined,
      },
    };

    await this.client.pubsub.publish(this.pubsubName, topic, cloudEvent);

    logger.info(`Event published: ${eventType}`, {
      correlationId,
      topic,
      eventType,
      pubsubName: this.pubsubName,
      dataSize: JSON.stringify(data).length,
    });

    return true;
  }

  /**
   * Publish review.created event
   */
  async publishReviewCreated(review, correlationId = null) {
    const eventData = {
      reviewId: review.reviewId,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title || '',
      comment: review.comment || '',
      verified: review.isVerifiedPurchase || false,
      createdAt: review.createdAt,
      metadata: {
        eventVersion: '1.0',
        retryCount: 0,
        source: 'review-service',
        environment: process.env.NODE_ENV || 'development',
      },
    };
    return this.publishEvent('review.created', 'review.created', eventData, correlationId);
  }

  /**
   * Publish review.updated event
   */
  async publishReviewUpdated(review, correlationId = null) {
    const eventData = {
      reviewId: review.reviewId,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      previousRating: review.previousRating || null,
      title: review.title || '',
      comment: review.comment || '',
      verified: review.isVerifiedPurchase || false,
      updatedAt: review.updatedAt || new Date().toISOString(),
      metadata: {
        eventVersion: '1.0',
        retryCount: 0,
        source: 'review-service',
        environment: process.env.NODE_ENV || 'development',
      },
    };
    return this.publishEvent('review.updated', 'review.updated', eventData, correlationId);
  }

  /**
   * Publish review.deleted event
   */
  async publishReviewDeleted(data, correlationId = null) {
    const eventData = {
      reviewId: data.reviewId,
      productId: data.productId,
      userId: data.userId,
      rating: data.rating || 0,
      verified: data.isVerifiedPurchase || false,
      deletedAt: new Date().toISOString(),
      metadata: {
        eventVersion: '1.0',
        retryCount: 0,
        source: 'review-service',
        environment: process.env.NODE_ENV || 'development',
      },
    };
    return this.publishEvent('review.deleted', 'review.deleted', eventData, correlationId);
  }

  /**
   * Close Dapr client
   */
  async close() {
    if (this.client) {
      logger.info('Closing Dapr Event Publisher');
      this.client = null;
    }
  }
}

// Export singleton instance
const eventPublisher = new DaprEventPublisher();

export default eventPublisher;
