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
      reviewId: review._id?.toString() || review.reviewId,
      productId: review.productId?.toString() || review.productId,
      userId: review.userId?.toString() || review.userId,
      username: review.username,
      rating: review.rating,
      title: review.title || '',
      comment: review.comment || '',
      isVerifiedPurchase: review.isVerifiedPurchase || false,
      orderReference: review.orderReference || null,
      status: review.status || 'pending',
      helpfulCount: review.helpfulVotes?.helpful || 0,
      createdAt: review.createdAt?.toISOString() || new Date().toISOString(),
    };

    const metadata = {
      correlationId: correlationId || `review-${eventData.reviewId}`,
      userId: eventData.userId,
      causationId: review.orderReference || null,
    };

    const cloudEvent = {
      specversion: '1.0',
      type: 'review.created',
      source: this.serviceName,
      id: correlationId || `review-created-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: eventData,
      metadata: metadata,
    };

    if (!this.client) {
      logger.warn('Dapr client not initialized. Skipping review.created event.', {
        reviewId: eventData.reviewId,
      });
      return false;
    }

    await this.client.pubsub.publish(this.pubsubName, 'review-events', cloudEvent);

    logger.info('Review created event published', {
      reviewId: eventData.reviewId,
      productId: eventData.productId,
      correlationId: metadata.correlationId,
    });

    return true;
  }

  /**
   * Publish review.updated event
   */
  async publishReviewUpdated(review, previousRating, correlationId = null) {
    const eventData = {
      reviewId: review._id?.toString() || review.reviewId,
      productId: review.productId?.toString() || review.productId,
      userId: review.userId?.toString() || review.userId,
      username: review.username,
      rating: review.rating,
      previousRating: previousRating,
      title: review.title || '',
      comment: review.comment || '',
      isVerifiedPurchase: review.isVerifiedPurchase || false,
      status: review.status || 'pending',
      updatedAt: review.updatedAt?.toISOString() || new Date().toISOString(),
    };

    const metadata = {
      correlationId: correlationId || `review-update-${eventData.reviewId}`,
      userId: eventData.userId,
    };

    const cloudEvent = {
      specversion: '1.0',
      type: 'review.updated',
      source: this.serviceName,
      id: correlationId || `review-updated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: eventData,
      metadata: metadata,
    };

    if (!this.client) {
      logger.warn('Dapr client not initialized. Skipping review.updated event.', {
        reviewId: eventData.reviewId,
      });
      return false;
    }

    await this.client.pubsub.publish(this.pubsubName, 'review-events', cloudEvent);

    logger.info('Review updated event published', {
      reviewId: eventData.reviewId,
      productId: eventData.productId,
      previousRating,
      newRating: eventData.rating,
      correlationId: metadata.correlationId,
    });

    return true;
  }

  /**
   * Publish review.deleted event
   */
  async publishReviewDeleted(review, correlationId = null) {
    const eventData = {
      reviewId: review._id?.toString() || review.reviewId,
      productId: review.productId?.toString() || review.productId,
      userId: review.userId?.toString() || review.userId,
      rating: review.rating || 0,
      isVerifiedPurchase: review.isVerifiedPurchase || false,
      deletedAt: new Date().toISOString(),
      deletedBy: review.deletedBy || review.userId?.toString(),
    };

    const metadata = {
      correlationId: correlationId || `review-delete-${eventData.reviewId}`,
      userId: eventData.userId,
    };

    const cloudEvent = {
      specversion: '1.0',
      type: 'review.deleted',
      source: this.serviceName,
      id: correlationId || `review-deleted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: eventData,
      metadata: metadata,
    };

    if (!this.client) {
      logger.warn('Dapr client not initialized. Skipping review.deleted event.', {
        reviewId: eventData.reviewId,
      });
      return false;
    }

    await this.client.pubsub.publish(this.pubsubName, 'review-events', cloudEvent);

    logger.info('Review deleted event published', {
      reviewId: eventData.reviewId,
      productId: eventData.productId,
      correlationId: metadata.correlationId,
    });

    return true;
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
