import config from '../core/config.js';

/**
 * Service information endpoint
 * @route GET / or GET /info
 */
export const info = (req, res) => {
  res.json({
    service: config.serviceName,
    version: config.serviceVersion,
    description: 'AI Outlet Review and Rating Service',
    environment: config.env,
    timestamp: new Date().toISOString(),
    endpoints: {
      reviews: '/api/v1/reviews',
      health: '/health',
      readiness: '/health/ready',
      liveness: '/health/live',
      metrics: '/metrics',
    },
    correlationId: req.correlationId,
  });
};

export default {
  info,
};
