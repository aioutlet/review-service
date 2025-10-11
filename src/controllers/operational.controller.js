/**
 * Operational Controller for Review Service
 * Handles health checks, readiness probes, and metrics endpoints
 */

import mongoose from 'mongoose';
import redisClient from '../config/redis.js';
import logger from '../observability/index.js';
import config from '../config/index.js';

/**
 * Basic health check endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const health = async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'review-service',
      version: config.observability?.serviceVersion || '1.0.0',
      environment: config.env,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', req, { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

/**
 * Readiness probe - checks if service is ready to accept traffic
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const readiness = async (req, res) => {
  const checks = {
    database: false,
    cache: false,
    // messaging: false,
  };

  let overallStatus = 'ready';
  let statusCode = 200;

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      checks.database = true;
    } else {
      overallStatus = 'not_ready';
      statusCode = 503;
    }

    // Check Redis connection
    if (redisClient && redisClient.isReady) {
      checks.cache = true;
    } else {
      overallStatus = 'not_ready';
      statusCode = 503;
    }

    // TODO: Check RabbitMQ connection when messaging is implemented
    // checks.messaging = rabbitmqService.isConnected();

    const readinessStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'review-service',
      checks,
      details: {
        database: {
          status: checks.database ? 'connected' : 'disconnected',
          state: mongoose.connection.readyState,
        },
        cache: {
          status: checks.cache ? 'connected' : 'disconnected',
          ready: redisClient?.isReady || false,
        },
      },
    };

    if (overallStatus === 'ready') {
      logger.debug('Readiness check passed', req);
    } else {
      logger.warn('Readiness check failed', req, { checks });
    }

    res.status(statusCode).json(readinessStatus);
  } catch (error) {
    logger.error('Readiness check error', req, { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks,
    });
  }
};

/**
 * Liveness probe - checks if service is alive
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const liveness = async (req, res) => {
  try {
    const livenessStatus = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'review-service',
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        usage: process.memoryUsage(),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    };

    res.status(200).json(livenessStatus);
  } catch (error) {
    logger.error('Liveness check failed', req, { error });
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

/**
 * Metrics endpoint for monitoring systems (Prometheus format)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const metrics = async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Basic Prometheus format metrics
    const metrics = [
      '# HELP review_service_uptime_seconds Total uptime of the service in seconds',
      '# TYPE review_service_uptime_seconds counter',
      `review_service_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP review_service_memory_usage_bytes Memory usage in bytes',
      '# TYPE review_service_memory_usage_bytes gauge',
      `review_service_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
      `review_service_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`,
      `review_service_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`,
      `review_service_memory_usage_bytes{type="external"} ${memUsage.external}`,
      '',
      '# HELP review_service_cpu_usage_microseconds CPU usage in microseconds',
      '# TYPE review_service_cpu_usage_microseconds counter',
      `review_service_cpu_usage_microseconds{type="user"} ${cpuUsage.user}`,
      `review_service_cpu_usage_microseconds{type="system"} ${cpuUsage.system}`,
      '',
      '# HELP review_service_database_connection Database connection status',
      '# TYPE review_service_database_connection gauge',
      `review_service_database_connection ${mongoose.connection.readyState}`,
      '',
      '# HELP review_service_cache_connection Cache connection status',
      '# TYPE review_service_cache_connection gauge',
      `review_service_cache_connection ${redisClient?.isReady ? 1 : 0}`,
      '',
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error', req, { error });
    res.status(500).json({
      error: 'Failed to generate metrics',
      message: error.message,
    });
  }
};

/**
 * Service information endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const info = async (req, res) => {
  try {
    const serviceInfo = {
      name: 'review-service',
      version: config.observability?.serviceVersion || '1.0.0',
      environment: config.env,
      description: 'AI Outlet Review and Rating Service',
      features: {
        reviews: 'Create, read, update, and delete product reviews',
        ratings: 'Product rating aggregation and analytics',
        moderation: 'Review content moderation and approval',
        analytics: 'Review metrics and insights',
        voting: 'Review helpfulness voting system',
        verification: 'Purchase verification for reviews',
      },
      endpoints: {
        health: '/health',
        readiness: '/health/ready',
        liveness: '/health/live',
        metrics: '/metrics',
        api: '/api/v1',
      },
      dependencies: {
        database: 'MongoDB',
        cache: 'Redis',
        messaging: 'RabbitMQ',
      },
      build: {
        timestamp: new Date().toISOString(),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    res.status(200).json(serviceInfo);
  } catch (error) {
    logger.error('Service info endpoint error', req, { error });
    res.status(500).json({
      error: 'Failed to get service info',
      message: error.message,
    });
  }
};

export default {
  health,
  readiness,
  liveness,
  metrics,
  info,
};
