import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { TooManyRequestsError } from '../utils/errors.js';

/**
 * Create rate limiter with custom configuration
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limit middleware
 */
const createRateLimiter = (options) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = null,
    onLimitReached = null,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message,
      },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator:
      keyGenerator ||
      ((req) => {
        // Use IP address and optionally user ID for rate limiting
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.user?.userId || 'anonymous';
        return `${ip}:${userId}`;
      }),
    handler: (req, res) => {
      const correlationId = req.correlationId;
      const key = req.rateLimit?.current || 'unknown';

      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        correlationId,
        rateLimitKey: key,
      });

      if (onLimitReached) {
        onLimitReached(req, res);
      }

      const error = new TooManyRequestsError(message);
      res.status(429).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          retryAfter: Math.round(windowMs / 1000),
        },
      });
    },
  });
};

/**
 * Create speed limiter to slow down repeated requests
 * @param {Object} options - Speed limit options
 * @returns {Function} Speed limit middleware
 */
const createSpeedLimiter = (options) => {
  const {
    windowMs = config.rateLimit.windowMs,
    delayAfter = Math.floor(config.rateLimit.maxRequests * 0.5),
    delayMs = 500,
    maxDelayMs = 20000,
    keyGenerator = null,
  } = options;

  return slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs,
    keyGenerator:
      keyGenerator ||
      ((req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.user?.userId || 'anonymous';
        return `${ip}:${userId}`;
      }),
  });
};

// General rate limiter for all routes
export const generalRateLimit = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
});

// Strict rate limiter for review creation
export const reviewCreationRateLimit = createRateLimiter({
  windowMs: config.rateLimit.reviewCreation.windowMs,
  max: config.rateLimit.reviewCreation.max,
  message: 'Too many reviews created, please wait before creating another review',
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Rate limit by user ID for review creation
    const userId = req.user?.userId || req.ip;
    return `review-creation:${userId}`;
  },
  onLimitReached: (req, res) => {
    logger.warn('Review creation rate limit exceeded', {
      userId: req.user?.userId,
      ip: req.ip,
      correlationId: req.correlationId,
    });
  },
});

// Rate limiter for voting on reviews
export const votingRateLimit = createRateLimiter({
  windowMs: config.rateLimit.voting.windowMs,
  max: config.rateLimit.voting.max,
  message: 'Too many votes, please slow down',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `voting:${userId}`;
  },
});

// Rate limiter for flagging reviews
export const flaggingRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 flags per hour
  message: 'Too many flags submitted, please wait before flagging more content',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `flagging:${userId}`;
  },
});

// Admin rate limiter (more permissive)
export const adminRateLimit = createRateLimiter({
  windowMs: config.rateLimit.admin.windowMs,
  max: config.rateLimit.admin.max,
  message: 'Too many admin requests, please slow down',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `admin:${userId}`;
  },
});

// Speed limiter for general use
export const generalSpeedLimit = createSpeedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Max delay of 20 seconds
});

// IP-based rate limiter for anonymous users
export const anonymousRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Lower limit for anonymous users
  message: 'Too many requests from this IP, please consider signing in for higher limits',
  keyGenerator: (req) => {
    // Only use IP for anonymous users
    if (req.user?.userId) {
      return null; // Skip rate limiting for authenticated users
    }
    return req.ip || req.connection.remoteAddress;
  },
});

// Upload rate limiter for media uploads
export const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many file uploads, please wait before uploading more files',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `upload:${userId}`;
  },
});

// Search rate limiter
export const searchRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests, please slow down',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `search:${userId}`;
  },
});

// Analytics rate limiter
export const analyticsRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 analytics requests per minute
  message: 'Too many analytics requests, please wait',
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.ip;
    return `analytics:${userId}`;
  },
});

// Combined middleware factory for easy use
export const createCombinedRateLimit = (options = {}) => {
  const { useSpeedLimit = true, useRateLimit = true, rateLimitOptions = {}, speedLimitOptions = {} } = options;

  const middlewares = [];

  if (useSpeedLimit) {
    middlewares.push(createSpeedLimiter(speedLimitOptions));
  }

  if (useRateLimit) {
    middlewares.push(createRateLimiter(rateLimitOptions));
  }

  return middlewares;
};

// Export default object with common rate limiters
export default {
  general: generalRateLimit,
  reviewCreation: reviewCreationRateLimit,
  voting: votingRateLimit,
  flagging: flaggingRateLimit,
  admin: adminRateLimit,
  anonymous: anonymousRateLimit,
  upload: uploadRateLimit,
  search: searchRateLimit,
  analytics: analyticsRateLimit,
  speed: generalSpeedLimit,
  createRateLimiter,
  createSpeedLimiter,
  createCombinedRateLimit,
};
