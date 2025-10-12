import jwt from 'jsonwebtoken';
import config from '../shared/config/index.js';
import logger from '../shared/observability/index.js';
import { UnauthorizedError, ForbiddenError } from '../shared/utils/errors.js';

/**
 * Middleware to verify JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Authorization header missing');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedError('Token missing');
    }

    const decoded = jwt.verify(token, config.security.jwtSecret);

    // Add user information to request
    req.user = {
      userId: decoded.userId || decoded.sub,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles || [],
      isAdmin: decoded.isAdmin || false,
      isVerified: decoded.isVerified || false,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    // Log authentication success
    logger.debug('User authenticated successfully', {
      userId: req.user.userId,
      username: req.user.username,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error.message,
      authHeader: req.headers.authorization ? 'present' : 'missing',
      correlationId: req.correlationId,
      ip: req.ip,
    });

    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }

    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }

    if (error.name === 'NotBeforeError') {
      return next(new UnauthorizedError('Token not active'));
    }

    next(error);
  }
};

/**
 * Optional authentication middleware
 * Sets user if token is valid, but doesn't fail if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, config.security.jwtSecret);

    req.user = {
      userId: decoded.userId || decoded.sub,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles || [],
      isAdmin: decoded.isAdmin || false,
      isVerified: decoded.isVerified || false,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (error) {
    // Token is invalid, but we don't fail the request
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message,
      correlationId: req.correlationId,
    });

    req.user = null;
    next();
  }
};

/**
 * Middleware to check if user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isAdmin) {
    logger.warn('Admin access denied', {
      userId: req.user.userId,
      username: req.user.username,
      correlationId: req.correlationId,
      endpoint: req.originalUrl,
    });

    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

/**
 * Middleware to check if user has specific role
 * @param {String|Array} requiredRoles - Required role(s)
 * @returns {Function} Middleware function
 */
export const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole && !req.user.isAdmin) {
      logger.warn('Role access denied', {
        userId: req.user.userId,
        username: req.user.username,
        userRoles,
        requiredRoles: roles,
        correlationId: req.correlationId,
        endpoint: req.originalUrl,
      });

      return next(new ForbiddenError(`Required role(s): ${roles.join(', ')}`));
    }

    next();
  };
};

/**
 * Middleware to check if user is verified
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isVerified && !req.user.isAdmin) {
    logger.warn('Verified user access denied', {
      userId: req.user.userId,
      username: req.user.username,
      isVerified: req.user.isVerified,
      correlationId: req.correlationId,
      endpoint: req.originalUrl,
    });

    return next(new ForbiddenError('Email verification required'));
  }

  next();
};

/**
 * Middleware to check resource ownership
 * @param {String} resourceField - Field name to check ownership (e.g., 'userId')
 * @param {String} paramName - Parameter name in req.params (default: 'userId')
 * @returns {Function} Middleware function
 */
export const requireOwnership = (resourceField = 'userId', paramName = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      // Admin can access any resource
      if (req.user.isAdmin) {
        return next();
      }

      const resourceUserId = req.params[paramName] || req.body[resourceField];

      if (!resourceUserId) {
        return next(new ForbiddenError('Resource identifier missing'));
      }

      if (req.user.userId !== resourceUserId) {
        logger.warn('Ownership access denied', {
          userId: req.user.userId,
          resourceUserId,
          resourceField,
          correlationId: req.correlationId,
          endpoint: req.originalUrl,
        });

        return next(new ForbiddenError('You can only access your own resources'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to extract user ID from token for internal services
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const extractUserId = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (token) {
        try {
          const decoded = jwt.verify(token, config.security.jwtSecret);
          req.userId = decoded.userId || decoded.sub;
        } catch (error) {
          // Token invalid, but we don't fail - just don't set userId
          logger.debug('Token extraction failed', {
            error: error.message,
            correlationId: req.correlationId,
          });
        }
      }
    }

    // Also check for user ID in headers (for internal service calls)
    if (!req.userId && req.headers['x-user-id']) {
      req.userId = req.headers['x-user-id'];
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware for API key authentication (for internal services)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const verifyApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return next(new UnauthorizedError('API key required'));
    }

    // In a real implementation, you would validate the API key against a database
    // For now, we'll use a simple check against environment variable
    const validApiKey = process.env.INTERNAL_API_KEY;

    if (!validApiKey || apiKey !== validApiKey) {
      logger.warn('Invalid API key', {
        apiKey: apiKey.substring(0, 8) + '...',
        correlationId: req.correlationId,
        ip: req.ip,
      });

      return next(new UnauthorizedError('Invalid API key'));
    }

    // Mark request as internal
    req.isInternal = true;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Alias for verifyToken - main authentication middleware
 */
export const authenticateUser = verifyToken;

export default {
  verifyToken,
  authenticateUser,
  optionalAuth,
  requireAdmin,
  requireRole,
  requireVerified,
  requireOwnership,
  extractUserId,
  verifyApiKey,
};
