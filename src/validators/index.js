/**
 * Validators Module - Review Service
 * Centralized export point for all validation functions
 */

// Core validators
export * from './review.validator.js';
export * from './analytics.validator.js';
export * from './moderation.validator.js';
export * from './config.validator.js';

// Validation utilities
export { default as ValidationUtility } from './review.validation.utility.js';

// Named exports for convenience
export { default as reviewValidator } from './review.validator.js';
export { default as analyticsValidator } from './analytics.validator.js';
export { default as moderationValidator } from './moderation.validator.js';
export { default as configValidator } from './config.validator.js';

/**
 * All available validation functions organized by domain
 */
export const validators = {
  review: {
    validateCreateReview: async (data) => {
      const { validateCreateReview } = await import('./review.validator.js');
      return validateCreateReview(data);
    },
    validateUpdateReview: async (data) => {
      const { validateUpdateReview } = await import('./review.validator.js');
      return validateUpdateReview(data);
    },
    validateRating: async (rating) => {
      const { validateRating } = await import('./review.validator.js');
      return validateRating(rating);
    },
    validateReviewVote: async (data) => {
      const { validateReviewVote } = await import('./review.validator.js');
      return validateReviewVote(data);
    },
    validateBulkReviews: async (data) => {
      const { validateBulkReviews } = await import('./review.validator.js');
      return validateBulkReviews(data);
    },
  },

  analytics: {
    validateAnalyticsQuery: async (data) => {
      const { validateAnalyticsQuery } = await import('./analytics.validator.js');
      return validateAnalyticsQuery(data);
    },
    validateDateRange: async (data) => {
      const { validateDateRange } = await import('./analytics.validator.js');
      return validateDateRange(data);
    },
    validateRatingDistribution: async (data) => {
      const { validateRatingDistribution } = await import('./analytics.validator.js');
      return validateRatingDistribution(data);
    },
    validateReportParameters: async (data) => {
      const { validateReportParameters } = await import('./analytics.validator.js');
      return validateReportParameters(data);
    },
  },

  moderation: {
    validateModerationAction: async (data) => {
      const { validateModerationAction } = await import('./moderation.validator.js');
      return validateModerationAction(data);
    },
    validateReviewFlag: async (data) => {
      const { validateReviewFlag } = await import('./moderation.validator.js');
      return validateReviewFlag(data);
    },
    validateBulkModeration: async (data) => {
      const { validateBulkModeration } = await import('./moderation.validator.js');
      return validateBulkModeration(data);
    },
    validateEscalation: async (data) => {
      const { validateEscalation } = await import('./moderation.validator.js');
      return validateEscalation(data);
    },
  },

  config: {
    validateConfig: async (config) => {
      const { validateConfig } = await import('./config.validator.js');
      return validateConfig(config);
    },
    validateEnvironmentConfig: async (environment, config) => {
      const { validateEnvironmentConfig } = await import('./config.validator.js');
      return validateEnvironmentConfig(environment, config);
    },
  },
};

/**
 * Validation middleware factory
 * Creates Express middleware for request validation
 */
export const createValidationMiddleware = (validatorFunction) => {
  return async (req, res, next) => {
    try {
      const validationResult = await validatorFunction(req.body);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
          code: 'VALIDATION_ERROR',
        });
      }

      // Attach validated data to request
      req.validatedData = validationResult.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal validation error',
        code: 'VALIDATION_SYSTEM_ERROR',
      });
    }
  };
};

/**
 * Bulk validation helper
 * Validates multiple items using the same validator
 */
export const validateBulk = async (items, validatorFunction) => {
  const results = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const result = await validatorFunction(items[i]);
      results.push({
        index: i,
        isValid: result.isValid,
        data: result.data,
        errors: result.errors,
      });
    } catch (error) {
      errors.push({
        index: i,
        error: error.message,
      });
    }
  }

  return {
    results,
    errors,
    totalItems: items.length,
    validItems: results.filter((r) => r.isValid).length,
    invalidItems: results.filter((r) => !r.isValid).length,
  };
};

export default {
  validators,
  createValidationMiddleware,
  validateBulk,
  ValidationUtility,
};
