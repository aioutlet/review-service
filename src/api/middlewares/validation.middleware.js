import { validationResult } from 'express-validator';
import logger from '../shared/observability/index.js';

/**
 * Middleware to validate request data using express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    logger.warn('Validation errors found', {
      correlationId: req.correlationId,
      errors: errorDetails,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(400).json({
      success: false,
      message: 'Validation errors found',
      errors: errorDetails,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Helper function to create success response format
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata
 * @returns {Object} Formatted success response
 */
export const createSuccessResponse = (data, message = 'Success', meta = {}) => {
  return {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
};

/**
 * Helper function to create error response format
 * @param {string} message - Error message
 * @param {*} details - Error details
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted error response
 */
export const createErrorResponse = (message, details = null, statusCode = 400) => {
  return {
    success: false,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
};

export default {
  validateRequest,
  createSuccessResponse,
  createErrorResponse,
};
