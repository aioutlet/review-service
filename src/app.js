import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Initialize OpenTelemetry tracing after environment is loaded
import { initializeTracing } from './observability/tracing/setup.js';
initializeTracing();

import config from './config/index.js';
import connectDB from './config/database.js';
import connectRedis from './config/redis.js';
import logger from './observability/index.js';
import { errorHandler } from './utils/errors.js';
import correlationIdMiddleware from './middlewares/correlationId.middleware.js';
import { tracingMiddleware, tracingErrorMiddleware, performanceMiddleware } from './middlewares/tracing.middleware.js';

// Import routes
import reviewRoutes from './routes/review.routes.js';
import moderationRoutes from './routes/moderation.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import internalRoutes from './routes/internal.routes.js';

// Import operational controllers
import { health, readiness, liveness, metrics } from './controllers/operational.controller.js';

// Import messaging
import rabbitmqService from './messaging/rabbitmq.js';

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Make logger available throughout the app
app.locals.logger = logger;

// Security and compression middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      if (config.security.corsOrigin.includes(origin) || config.security.corsOrigin.includes('*')) {
        return callback(null, true);
      }

      const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
      logger.warn('CORS policy violation', { origin });
      callback(error, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Correlation-ID',
      'X-User-ID',
      'X-API-Key',
      'Cache-Control',
    ],
    exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })
);

// Request parsing middleware
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// Core middleware
app.use(correlationIdMiddleware);
app.use(tracingMiddleware);
app.use(performanceMiddleware);

// Logging middleware
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim(), { source: 'http' }),
    },
    skip: (req, res) => {
      // Skip logging for health checks and metrics to reduce noise
      return (
        req.path === '/health' || req.path === '/health/ready' || req.path === '/health/live' || req.path === '/metrics'
      );
    },
  })
);

// Request tracking middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId: req.correlationId,
      userId: req.user?.userId || 'anonymous',
    });
  });

  next();
});

// API Routes
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/moderation', moderationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/internal', internalRoutes);

// Operational endpoints (health checks, metrics)
app.get('/health', health);
app.get('/health/ready', readiness);
app.get('/health/live', liveness);
app.get('/metrics', metrics);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'review-service',
    version: '1.0.0',
    description: 'AI Outlet Review and Rating Service',
    documentation: 'https://docs.aioutlet.com/api/review-service',
    endpoints: {
      reviews: '/api/v1/reviews',
      moderation: '/api/v1/moderation',
      analytics: '/api/v1/analytics',
      internal: '/api/v1/internal',
      health: '/health',
      metrics: '/metrics',
    },
    environment: config.env,
    correlationId: req.correlationId,
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Outlet Review Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
    },
  });
});

// Global error handler
app.use(tracingErrorMiddleware);
app.use(errorHandler);

/**
 * Initialize all services and start the server
 */
async function startServer() {
  try {
    logger.info('Starting Review Service...', {
      environment: config.env,
      port: config.server.port,
      host: config.server.host,
    });

    // Initialize databases
    logger.info('Connecting to databases...');
    await connectDB();
    await connectRedis();
    logger.info('Database connections established');

    // Initialize message broker
    logger.info('Connecting to message broker...');
    await rabbitmqService.connect();
    await rabbitmqService.startConsuming();
    logger.info('Message broker connected and consuming');

    // Start HTTP server
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info('🚀 Review service started successfully', {
        host: config.server.host,
        port: config.server.port,
        environment: config.env,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        processId: process.pid,
        uptime: process.uptime(),
      });

      // Log service URLs
      const baseUrl = `http://${config.server.host}:${config.server.port}`;
      logger.info('Service endpoints available:', {
        health: `${baseUrl}/health`,
        api: `${baseUrl}/api/v1`,
        documentation: `${baseUrl}/api`,
        metrics: `${baseUrl}/metrics`,
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.server.port} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = 30000; // 30 seconds
  const timeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, shutdownTimeout);

  try {
    // Stop accepting new connections
    logger.info('Stopping HTTP server...');

    // Close message broker connection
    logger.info('Closing message broker connection...');
    await rabbitmqService.close();

    // Close database connections (handled by their respective modules)
    logger.info('Closing database connections...');

    // Clear shutdown timeout
    clearTimeout(timeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', {
      error: error.message,
      stack: error.stack,
    });
    clearTimeout(timeout);
    process.exit(1);
  }
};

// Handle process signals
import { shutdownTracing } from './observability/tracing/setup.js';

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  process.exit(1);
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
