import amqp from 'amqplib';
import config from '../config/index.js';
import logger from '../observability/index.js';
import * as consumer from './consumer.js';

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
  }

  /**
   * Connect to RabbitMQ
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('RabbitMQ already connected');
        return;
      }

      logger.info('Connecting to RabbitMQ...', {
        url: config.messaging.rabbitmqUrl.replace(/\/\/[^@]*@/, '//***:***@'),
      });

      this.connection = await amqp.connect(config.messaging.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('RabbitMQ connected successfully');

      // Setup error handlers
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        this.isConnected = false;
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.handleConnectionError();
      });

      this.channel.on('error', (err) => {
        logger.error('RabbitMQ channel error:', err);
      });

      this.channel.on('close', () => {
        logger.warn('RabbitMQ channel closed');
      });

      // Setup exchanges and queues
      await this.setupExchangesAndQueues();
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Setup exchanges and queues
   * @returns {Promise<void>}
   */
  async setupExchangesAndQueues() {
    try {
      const { exchanges, queues } = config.messaging;

      // Declare exchanges
      await Promise.all([
        this.channel.assertExchange(exchanges.reviews, 'topic', { durable: true }),
        this.channel.assertExchange(exchanges.orders, 'topic', { durable: true }),
        this.channel.assertExchange(exchanges.users, 'topic', { durable: true }),
        this.channel.assertExchange(exchanges.products, 'topic', { durable: true }),
      ]);

      // Declare queues
      await Promise.all([
        this.channel.assertQueue(queues.reviewEvents, { durable: true }),
        this.channel.assertQueue(queues.orderCompleted, { durable: true }),
        this.channel.assertQueue(queues.userDeleted, { durable: true }),
        this.channel.assertQueue(queues.productDeleted, { durable: true }),
      ]);

      // Bind queues to exchanges
      await Promise.all([
        // Review events
        this.channel.bindQueue(queues.reviewEvents, exchanges.reviews, 'review.created'),
        this.channel.bindQueue(queues.reviewEvents, exchanges.reviews, 'review.updated'),
        this.channel.bindQueue(queues.reviewEvents, exchanges.reviews, 'review.deleted'),
        this.channel.bindQueue(queues.reviewEvents, exchanges.reviews, 'review.moderated'),
        this.channel.bindQueue(queues.reviewEvents, exchanges.reviews, 'product.rating.updated'),

        // Order events
        this.channel.bindQueue(queues.orderCompleted, exchanges.orders, 'order.completed'),

        // User events
        this.channel.bindQueue(queues.userDeleted, exchanges.users, 'user.deleted'),

        // Product events
        this.channel.bindQueue(queues.productDeleted, exchanges.products, 'product.deleted'),
      ]);

      logger.info('RabbitMQ exchanges and queues setup completed');
    } catch (error) {
      logger.error('Failed to setup exchanges and queues:', error);
      throw error;
    }
  }

  /**
   * Handle connection errors and attempt reconnection
   * @returns {Promise<void>}
   */
  async handleConnectionError() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up on RabbitMQ connection.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(async () => {
      try {
        await this.connect();
        await this.startConsuming();
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
        this.handleConnectionError();
      }
    }, this.reconnectDelay);
  }

  /**
   * Publish message to exchange
   * @param {String} exchange - Exchange name
   * @param {String} routingKey - Routing key
   * @param {Object} message - Message content
   * @param {Object} options - Publish options
   * @returns {Promise<Boolean>} Success status
   */
  async publish(exchange, routingKey, message, options = {}) {
    if (!this.isConnected || !this.channel) {
      logger.warn('Cannot publish message - RabbitMQ not connected', { exchange, routingKey });
      return false;
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const defaultOptions = {
        persistent: true,
        timestamp: Date.now(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...options,
      };

      const result = this.channel.publish(exchange, routingKey, messageBuffer, defaultOptions);

      if (result) {
        logger.debug('Message published successfully', {
          exchange,
          routingKey,
          messageId: defaultOptions.messageId,
        });
      } else {
        logger.warn('Message publish returned false - channel may be full', {
          exchange,
          routingKey,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to publish message:', {
        error: error.message,
        exchange,
        routingKey,
      });
      return false;
    }
  }

  /**
   * Start consuming messages
   * @returns {Promise<void>}
   */
  async startConsuming() {
    if (!this.isConnected || !this.channel) {
      logger.warn('Cannot start consuming - RabbitMQ not connected');
      return;
    }

    try {
      const { queues } = config.messaging;

      // Set prefetch count to control message processing
      await this.channel.prefetch(10);

      // Start consumers
      await Promise.all([
        this.startConsumer(queues.orderCompleted, consumer.handleOrderCompleted),
        this.startConsumer(queues.userDeleted, consumer.handleUserDeleted),
        this.startConsumer(queues.productDeleted, consumer.handleProductDeleted),
      ]);

      logger.info('RabbitMQ consumers started successfully');
    } catch (error) {
      logger.error('Failed to start consuming messages:', error);
      throw error;
    }
  }

  /**
   * Start a consumer for a specific queue
   * @param {String} queue - Queue name
   * @param {Function} handler - Message handler function
   * @returns {Promise<void>}
   */
  async startConsumer(queue, handler) {
    try {
      await this.channel.consume(
        queue,
        async (msg) => {
          if (!msg) {
            logger.warn('Received null message', { queue });
            return;
          }

          try {
            const content = JSON.parse(msg.content.toString());
            const correlationId =
              msg.properties.correlationId || msg.properties.headers?.correlationId || `consumer_${Date.now()}`;

            logger.debug('Processing message', {
              queue,
              messageId: msg.properties.messageId,
              correlationId,
            });

            await handler(content, correlationId);

            // Acknowledge message
            this.channel.ack(msg);

            logger.debug('Message processed successfully', {
              queue,
              messageId: msg.properties.messageId,
              correlationId,
            });
          } catch (error) {
            logger.error('Error processing message:', {
              error: error.message,
              queue,
              messageId: msg.properties.messageId,
            });

            // Reject message and don't requeue to avoid infinite loops
            this.channel.nack(msg, false, false);
          }
        },
        { noAck: false }
      );

      logger.info(`Consumer started for queue: ${queue}`);
    } catch (error) {
      logger.error(`Failed to start consumer for queue: ${queue}`, error);
      throw error;
    }
  }

  /**
   * Close RabbitMQ connection
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
        logger.info('RabbitMQ channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
        logger.info('RabbitMQ connection closed');
      }

      this.isConnected = false;
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   * @returns {Boolean} Connection status
   */
  isReady() {
    return this.isConnected && this.channel !== null;
  }

  /**
   * Get channel for direct use (use with caution)
   * @returns {Object|null} RabbitMQ channel
   */
  getChannel() {
    return this.channel;
  }

  /**
   * Health check method
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      connected: this.isConnected,
      channel: this.channel !== null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export default new RabbitMQService();
