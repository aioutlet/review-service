/**
 * Dapr Event Publisher for Review Service
 * Publishes events via Dapr pub/sub component
 */

import { DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import { config, logger } from '../core/index.js';

class DaprEventPublisher {
  constructor() {
    this.pubsubName = process.env.DAPR_PUBSUB_NAME || 'review-pubsub';
    this.serviceName = config.service.name;
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
    return this.publishEvent('review-events', 'review.created', review, correlationId);
  }

  /**
   * Publish review.updated event
   */
  async publishReviewUpdated(review, correlationId = null) {
    return this.publishEvent('review-events', 'review.updated', review, correlationId);
  }

  /**
   * Publish review.deleted event
   */
  async publishReviewDeleted(reviewId, productId, correlationId = null) {
    return this.publishEvent('review-events', 'review.deleted', { reviewId, productId }, correlationId);
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
