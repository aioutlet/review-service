import mongoose from 'mongoose';
import { logger, config } from '../core/index.js';
import eventPublisher from '../events/publisher.js';

export function health(req, res) {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    version: config.serviceVersion,
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export async function readiness(req, res) {
  try {
    const dbState = mongoose.connection.readyState;
    const isDatabaseReady = dbState === 1;

    // Check Dapr sidecar health
    let isDaprReady = false;
    try {
      if (eventPublisher.client) {
        await eventPublisher.client.metadata.get();
        isDaprReady = true;
      }
    } catch (error) {
      logger.warn('Dapr health check failed', { error: error.message });
    }

    const isReady = isDatabaseReady && isDaprReady;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'not ready',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: isDatabaseReady ? 'healthy' : 'unhealthy',
          readyState: dbState,
        },
        dapr: {
          status: isDaprReady ? 'healthy' : 'unhealthy',
        },
      },
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

export async function liveness(req, res) {
  res.json({
    status: 'alive',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export function metrics(req, res) {
  const memoryUsage = process.memoryUsage();

  res.json({
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
  });
}

export default {
  health,
  readiness,
  liveness,
  metrics,
};
