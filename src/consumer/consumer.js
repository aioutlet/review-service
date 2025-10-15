/**
 * Review Service Consumer
 * Consumes and processes events from message broker
 */

import '../shared/observability/tracing/setup.js'; // Initialize tracing first
import config from '../shared/config/index.js';
import connectDB from '../shared/config/database.js';
import connectRedis from '../shared/config/redis.js';
import logger from '../shared/observability/index.js';
import MessageBrokerFactory from '../shared/messaging/MessageBrokerFactory.js';
import eventHandlers from './handlers/index.js';

const messageBroker = MessageBrokerFactory.create();
let isShuttingDown = false;

/**
 * Initialize and start the consumer
 */
async function startConsumer() {
  try {
    logger.info('🔧 Starting Review Service Consumer...', null, {
      metadata: {
        environment: config.env,
        serviceType: 'consumer',
        nodeVersion: process.version,
        processId: process.pid,
      },
    });

    // Initialize databases
    logger.info('Connecting to databases...');
    await connectDB();
    await connectRedis();
    logger.info('✅ Database connections established');

    // Initialize message broker
    logger.info('Connecting to message broker...');
    await messageBroker.connect();

    // Register all event handlers
    logger.info('Registering event handlers...');
    Object.entries(eventHandlers).forEach(([eventType, handler]) => {
      messageBroker.registerEventHandler(eventType, handler);
      logger.info(`✓ Registered handler for: ${eventType}`);
    });

    // Start consuming messages
    await messageBroker.startConsuming();
    logger.info('✅ Consumer started successfully - Processing events', null, {
      metadata: {
        registeredHandlers: Object.keys(eventHandlers),
        queue: process.env.MESSAGE_BROKER_QUEUE || 'review-service.queue',
        concurrency: process.env.CONSUMER_CONCURRENCY || process.env.WORKER_CONCURRENCY || 10,
      },
    });

    logger.info('📊 Consumer Status:', null, {
      metadata: {
        status: 'running',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    logger.error('❌ Failed to start consumer', null, { error });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('💀 Force shutdown - received second signal');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('💀 Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Close message broker connection
    logger.info('Closing message broker connection...');
    await messageBroker.close();

    // Close database connections (handled by their respective modules)
    logger.info('Closing database connections...');

    clearTimeout(shutdownTimeout);
    logger.info('✅ Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', null, { error });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception in Consumer', null, { error });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection in Consumer', null, {
    error: reason,
    metadata: { promise: String(promise) },
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the consumer
startConsumer();
