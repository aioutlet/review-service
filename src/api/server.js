/**
 * Review Service API Server
 * HTTP API for managing reviews and ratings
 */

import '../common/observability/tracing/setup.js'; // Initialize tracing first
import config from '../shared/config/index.js';
import connectDB from '../shared/config/database.js';
import connectRedis from '../shared/config/redis.js';
import logger from '../common/observability/index.js';
import createApp from './app.js';

let server;
let isShuttingDown = false;

/**
 * Initialize and start the API server
 */
async function startAPI() {
  try {
    logger.info('🚀 Starting Review Service API...', null, {
      metadata: {
        environment: config.env,
        serviceType: 'api',
        port: config.server.port,
        host: config.server.host,
        nodeVersion: process.version,
        processId: process.pid,
      },
    });

    // Initialize databases
    logger.info('Connecting to databases...');
    await connectDB();
    await connectRedis();
    logger.info('✅ Database connections established');

    // Create Express app (includes publisher setup)
    const app = createApp();

    // Start HTTP server
    server = app.listen(config.server.port, config.server.host, () => {
      logger.info('✅ API Server started successfully', null, {
        metadata: {
          host: config.server.host,
          port: config.server.port,
          environment: config.env,
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          processId: process.pid,
          uptime: process.uptime(),
        },
      });

      // Log service URLs
      const baseUrl = `http://${config.server.host}:${config.server.port}`;
      logger.info('📊 Service endpoints available:', null, {
        metadata: {
          health: `${baseUrl}/health`,
          api: `${baseUrl}/api/v1`,
          documentation: `${baseUrl}/api`,
          metrics: `${baseUrl}/metrics`,
        },
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${config.server.port} is already in use`, null, { error });
      } else {
        logger.error('❌ Server error', null, { error });
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start API server', null, { error });
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
    // Stop accepting new connections
    if (server) {
      logger.info('Stopping HTTP server...');
      server.close(() => {
        logger.info('✅ HTTP server stopped');
      });
    }

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
  logger.error('💥 Uncaught Exception in API', null, { error });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection in API', null, {
    error: reason,
    metadata: { promise: String(promise) },
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the API server
startAPI();
