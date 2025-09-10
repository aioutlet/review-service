import reviewValidator from './review.validator.js';
import analyticsValidator from './analytics.validator.js';
import moderationValidator from './moderation.validator.js';
import { ValidationError, BadRequestError } from '../utils/errors.js';

/**
 * Comprehensive validation utility for review service data
 * Handles validation for various operations and data types
 */
class ReviewValidationUtility {
  /**
   * Validates review data for create operations
   * @param {Object} reviewData - The review data to validate
   * @param {Object} options - Validation options
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateReviewForCreate(reviewData, options = {}) {
    const { requirePurchaseVerification = false } = options;
    const errors = [];
    const detailedErrors = [];

    // Required fields validation
    if (!reviewData.userId) {
      errors.push('User ID is required');
      detailedErrors.push({ message: 'User ID is required', code: 'USER_ID_REQUIRED', field: 'userId' });
    } else if (!reviewValidator.isValidUserId(reviewData.userId)) {
      errors.push('Invalid user ID format');
      detailedErrors.push({ message: 'Invalid user ID format', code: 'INVALID_USER_ID', field: 'userId' });
    }

    if (!reviewData.productId) {
      errors.push('Product ID is required');
      detailedErrors.push({ message: 'Product ID is required', code: 'PRODUCT_ID_REQUIRED', field: 'productId' });
    } else if (!reviewValidator.isValidProductId(reviewData.productId)) {
      errors.push('Invalid product ID format');
      detailedErrors.push({ message: 'Invalid product ID format', code: 'INVALID_PRODUCT_ID', field: 'productId' });
    }

    if (reviewData.rating === undefined || reviewData.rating === null) {
      errors.push('Rating is required');
      detailedErrors.push({ message: 'Rating is required', code: 'RATING_REQUIRED', field: 'rating' });
    } else {
      const ratingValidation = reviewValidator.isValidRating(reviewData.rating);
      if (!ratingValidation.valid) {
        errors.push(ratingValidation.error);
        detailedErrors.push({ message: ratingValidation.error, code: 'INVALID_RATING', field: 'rating' });
      }
    }

    if (!reviewData.title) {
      errors.push('Title is required');
      detailedErrors.push({ message: 'Title is required', code: 'TITLE_REQUIRED', field: 'title' });
    } else {
      const titleValidation = reviewValidator.isValidTitle(reviewData.title);
      if (!titleValidation.valid) {
        errors.push(titleValidation.error);
        detailedErrors.push({ message: titleValidation.error, code: 'INVALID_TITLE', field: 'title' });
      }
    }

    if (!reviewData.content) {
      errors.push('Content is required');
      detailedErrors.push({ message: 'Content is required', code: 'CONTENT_REQUIRED', field: 'content' });
    } else {
      const contentValidation = reviewValidator.isValidContent(reviewData.content);
      if (!contentValidation.valid) {
        errors.push(contentValidation.error);
        detailedErrors.push({ message: contentValidation.error, code: 'INVALID_CONTENT', field: 'content' });
      }
    }

    // Optional fields validation
    if (reviewData.status && !reviewValidator.isValidStatus(reviewData.status)) {
      errors.push('Invalid review status');
      detailedErrors.push({ message: 'Invalid review status', code: 'INVALID_STATUS', field: 'status' });
    }

    if (reviewData.sentiment) {
      const sentimentValidation = reviewValidator.isValidSentiment(reviewData.sentiment);
      if (!sentimentValidation.valid) {
        errors.push(sentimentValidation.error);
        detailedErrors.push({ message: sentimentValidation.error, code: 'INVALID_SENTIMENT', field: 'sentiment' });
      }
    }

    if (reviewData.metadata) {
      const metadataValidation = reviewValidator.isValidMetadata(reviewData.metadata);
      if (!metadataValidation.valid) {
        errors.push(metadataValidation.error);
        detailedErrors.push({ message: metadataValidation.error, code: 'INVALID_METADATA', field: 'metadata' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates review data for update operations
   * @param {Object} reviewData - The review data to validate
   * @param {Object} options - Validation options
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateReviewForUpdate(reviewData, options = {}) {
    const { allowStatusChange = false, isAdmin = false } = options;
    const errors = [];
    const detailedErrors = [];

    // Only validate provided fields
    if (reviewData.rating !== undefined) {
      const ratingValidation = reviewValidator.isValidRating(reviewData.rating);
      if (!ratingValidation.valid) {
        errors.push(ratingValidation.error);
        detailedErrors.push({ message: ratingValidation.error, code: 'INVALID_RATING', field: 'rating' });
      }
    }

    if (reviewData.title !== undefined) {
      const titleValidation = reviewValidator.isValidTitle(reviewData.title);
      if (!titleValidation.valid) {
        errors.push(titleValidation.error);
        detailedErrors.push({ message: titleValidation.error, code: 'INVALID_TITLE', field: 'title' });
      }
    }

    if (reviewData.content !== undefined) {
      const contentValidation = reviewValidator.isValidContent(reviewData.content);
      if (!contentValidation.valid) {
        errors.push(contentValidation.error);
        detailedErrors.push({ message: contentValidation.error, code: 'INVALID_CONTENT', field: 'content' });
      }
    }

    if (reviewData.status !== undefined) {
      if (!allowStatusChange && !isAdmin) {
        errors.push('Status cannot be modified by regular users');
        detailedErrors.push({
          message: 'Status cannot be modified by regular users',
          code: 'STATUS_CHANGE_FORBIDDEN',
          field: 'status',
        });
      } else if (!reviewValidator.isValidStatus(reviewData.status)) {
        errors.push('Invalid review status');
        detailedErrors.push({ message: 'Invalid review status', code: 'INVALID_STATUS', field: 'status' });
      }
    }

    // Admin-only fields
    if (reviewData.sentiment && !isAdmin) {
      errors.push('Sentiment can only be modified by administrators');
      detailedErrors.push({
        message: 'Sentiment can only be modified by administrators',
        code: 'SENTIMENT_ADMIN_ONLY',
        field: 'sentiment',
      });
    } else if (reviewData.sentiment) {
      const sentimentValidation = reviewValidator.isValidSentiment(reviewData.sentiment);
      if (!sentimentValidation.valid) {
        errors.push(sentimentValidation.error);
        detailedErrors.push({ message: sentimentValidation.error, code: 'INVALID_SENTIMENT', field: 'sentiment' });
      }
    }

    if (reviewData.metadata) {
      const metadataValidation = reviewValidator.isValidMetadata(reviewData.metadata);
      if (!metadataValidation.valid) {
        errors.push(metadataValidation.error);
        detailedErrors.push({ message: metadataValidation.error, code: 'INVALID_METADATA', field: 'metadata' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates vote data
   * @param {Object} voteData - The vote data to validate
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateVote(voteData) {
    const errors = [];
    const detailedErrors = [];

    if (!voteData.reviewId) {
      errors.push('Review ID is required');
      detailedErrors.push({ message: 'Review ID is required', code: 'REVIEW_ID_REQUIRED', field: 'reviewId' });
    } else if (!reviewValidator.isValidObjectId(voteData.reviewId)) {
      errors.push('Invalid review ID format');
      detailedErrors.push({ message: 'Invalid review ID format', code: 'INVALID_REVIEW_ID', field: 'reviewId' });
    }

    if (!voteData.userId) {
      errors.push('User ID is required');
      detailedErrors.push({ message: 'User ID is required', code: 'USER_ID_REQUIRED', field: 'userId' });
    } else if (!reviewValidator.isValidUserId(voteData.userId)) {
      errors.push('Invalid user ID format');
      detailedErrors.push({ message: 'Invalid user ID format', code: 'INVALID_USER_ID', field: 'userId' });
    }

    if (!voteData.voteType) {
      errors.push('Vote type is required');
      detailedErrors.push({ message: 'Vote type is required', code: 'VOTE_TYPE_REQUIRED', field: 'voteType' });
    } else if (!reviewValidator.isValidVoteType(voteData.voteType)) {
      errors.push('Invalid vote type');
      detailedErrors.push({ message: 'Invalid vote type', code: 'INVALID_VOTE_TYPE', field: 'voteType' });
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates flag data
   * @param {Object} flagData - The flag data to validate
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateFlag(flagData) {
    const errors = [];
    const detailedErrors = [];

    if (!flagData.reviewId) {
      errors.push('Review ID is required');
      detailedErrors.push({ message: 'Review ID is required', code: 'REVIEW_ID_REQUIRED', field: 'reviewId' });
    } else if (!reviewValidator.isValidObjectId(flagData.reviewId)) {
      errors.push('Invalid review ID format');
      detailedErrors.push({ message: 'Invalid review ID format', code: 'INVALID_REVIEW_ID', field: 'reviewId' });
    }

    if (!flagData.flaggedBy) {
      errors.push('Flagger user ID is required');
      detailedErrors.push({ message: 'Flagger user ID is required', code: 'FLAGGER_ID_REQUIRED', field: 'flaggedBy' });
    } else if (!reviewValidator.isValidUserId(flagData.flaggedBy)) {
      errors.push('Invalid flagger user ID format');
      detailedErrors.push({
        message: 'Invalid flagger user ID format',
        code: 'INVALID_FLAGGER_ID',
        field: 'flaggedBy',
      });
    }

    if (!flagData.reason) {
      errors.push('Flag reason is required');
      detailedErrors.push({ message: 'Flag reason is required', code: 'FLAG_REASON_REQUIRED', field: 'reason' });
    } else if (!reviewValidator.isValidFlagReason(flagData.reason)) {
      errors.push('Invalid flag reason');
      detailedErrors.push({ message: 'Invalid flag reason', code: 'INVALID_FLAG_REASON', field: 'reason' });
    }

    if (flagData.description) {
      const descValidation = reviewValidator.isValidFlagDescription(flagData.description);
      if (!descValidation.valid) {
        errors.push(descValidation.error);
        detailedErrors.push({ message: descValidation.error, code: 'INVALID_FLAG_DESCRIPTION', field: 'description' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates search parameters
   * @param {Object} searchParams - The search parameters to validate
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateSearchParams(searchParams) {
    const errors = [];
    const detailedErrors = [];

    const searchValidation = reviewValidator.isValidSearchParams(searchParams);
    if (!searchValidation.valid) {
      errors.push(searchValidation.error);
      detailedErrors.push({ message: searchValidation.error, code: 'INVALID_SEARCH_PARAMS' });
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates analytics query parameters
   * @param {Object} analyticsParams - The analytics parameters to validate
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateAnalyticsParams(analyticsParams) {
    const errors = [];
    const detailedErrors = [];

    // Validate date range
    if (analyticsParams.startDate || analyticsParams.endDate) {
      const dateValidation = analyticsValidator.isValidDateRange(analyticsParams.startDate, analyticsParams.endDate);
      if (!dateValidation.valid) {
        errors.push(dateValidation.error);
        detailedErrors.push({ message: dateValidation.error, code: 'INVALID_DATE_RANGE' });
      }
    }

    // Validate time period
    if (analyticsParams.period && !analyticsValidator.isValidTimePeriod(analyticsParams.period)) {
      errors.push('Invalid time period');
      detailedErrors.push({ message: 'Invalid time period', code: 'INVALID_TIME_PERIOD', field: 'period' });
    }

    // Validate metrics
    if (analyticsParams.metrics) {
      const metricsValidation = analyticsValidator.isValidMetrics(analyticsParams.metrics);
      if (!metricsValidation.valid) {
        errors.push(metricsValidation.error);
        detailedErrors.push({ message: metricsValidation.error, code: 'INVALID_METRICS', field: 'metrics' });
      }
    }

    // Validate filters
    if (analyticsParams.filters) {
      const filtersValidation = analyticsValidator.isValidFilters(analyticsParams.filters);
      if (!filtersValidation.valid) {
        errors.push(filtersValidation.error);
        detailedErrors.push({ message: filtersValidation.error, code: 'INVALID_FILTERS', field: 'filters' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Validates moderation data
   * @param {Object} moderationData - The moderation data to validate
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateModerationData(moderationData) {
    const errors = [];
    const detailedErrors = [];

    if (!moderationData.action) {
      errors.push('Moderation action is required');
      detailedErrors.push({ message: 'Moderation action is required', code: 'ACTION_REQUIRED', field: 'action' });
    } else {
      const actionValidation = moderationValidator.isValidModerationAction(moderationData.action);
      if (!actionValidation.valid) {
        errors.push(actionValidation.error);
        detailedErrors.push({ message: actionValidation.error, code: 'INVALID_ACTION', field: 'action' });
      }
    }

    // Validate reason (required for reject and flag actions)
    const requiresReason = ['reject', 'flag'].includes(moderationData.action?.toLowerCase());
    const reasonValidation = moderationValidator.isValidModerationReason(moderationData.reason, requiresReason);
    if (!reasonValidation.valid) {
      errors.push(reasonValidation.error);
      detailedErrors.push({ message: reasonValidation.error, code: 'INVALID_REASON', field: 'reason' });
    }

    if (moderationData.priority) {
      const priorityValidation = moderationValidator.isValidModerationPriority(moderationData.priority);
      if (!priorityValidation.valid) {
        errors.push(priorityValidation.error);
        detailedErrors.push({ message: priorityValidation.error, code: 'INVALID_PRIORITY', field: 'priority' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }

  /**
   * Gets allowed fields for review updates based on user role
   * @param {boolean} isAdmin - Whether the user is an admin
   * @param {boolean} isOwner - Whether the user owns the review
   * @returns {Array<string>} - Array of allowed field names
   */
  static getAllowedUpdateFields(isAdmin = false, isOwner = false) {
    const baseFields = [];

    if (isOwner) {
      baseFields.push('title', 'content', 'rating');
    }

    if (isAdmin) {
      baseFields.push('status', 'sentiment', 'isVerifiedPurchase', 'moderationNotes', 'flagged', 'metadata');
    }

    return baseFields;
  }

  /**
   * Filters data to only include allowed fields
   * @param {Object} data - The raw data
   * @param {Array<string>} allowedFields - Array of allowed field names
   * @returns {Object} - Filtered data with only allowed fields
   */
  static filterAllowedFields(data, allowedFields) {
    const filtered = {};
    for (const field of allowedFields) {
      if (field in data) {
        filtered[field] = data[field];
      }
    }
    return filtered;
  }

  /**
   * Throws appropriate error if validation fails
   * @param {Object} validation - Result from validation method
   * @param {string} defaultErrorCode - Default error code if not specified
   */
  static throwIfInvalid(validation, defaultErrorCode = 'VALIDATION_ERROR') {
    if (!validation.valid) {
      if (validation.detailedErrors && validation.detailedErrors.length > 0) {
        throw new ValidationError(validation.errors.join('; '), validation.detailedErrors);
      } else {
        throw new BadRequestError(validation.errors.join('; '), defaultErrorCode);
      }
    }
  }

  /**
   * Returns middleware-style error response for Express.js
   * @param {Object} validation - Result from validation method
   * @param {Function} next - Express next function
   * @param {string} defaultErrorCode - Default error code if not specified
   * @returns {Function|null} - Calls next with error or returns null if valid
   */
  static handleValidationError(validation, next, defaultErrorCode = 'VALIDATION_ERROR') {
    if (!validation.valid) {
      if (validation.detailedErrors && validation.detailedErrors.length > 0) {
        return next(new ValidationError(validation.errors.join('; '), validation.detailedErrors));
      } else {
        return next(new BadRequestError(validation.errors.join('; '), defaultErrorCode));
      }
    }
    return null;
  }

  /**
   * Validates bulk operations
   * @param {Array} items - Array of items to validate
   * @param {string} operation - The operation type (create, update, delete)
   * @param {Object} options - Validation options
   * @returns {Object} - { valid: boolean, errors: Array<string>, detailedErrors: Array<Object> }
   */
  static validateBulkOperation(items, operation, options = {}) {
    const errors = [];
    const detailedErrors = [];

    if (!Array.isArray(items)) {
      errors.push('Items must be an array');
      detailedErrors.push({ message: 'Items must be an array', code: 'INVALID_BULK_DATA' });
      return { valid: false, errors, detailedErrors };
    }

    if (items.length === 0) {
      errors.push('At least one item must be provided');
      detailedErrors.push({ message: 'At least one item must be provided', code: 'EMPTY_BULK_DATA' });
      return { valid: false, errors, detailedErrors };
    }

    if (items.length > 1000) {
      errors.push('Maximum 1000 items can be processed in bulk');
      detailedErrors.push({ message: 'Maximum 1000 items can be processed in bulk', code: 'BULK_SIZE_EXCEEDED' });
      return { valid: false, errors, detailedErrors };
    }

    // Validate each item based on operation
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let validation;

      switch (operation) {
        case 'create':
          validation = this.validateReviewForCreate(item, options);
          break;
        case 'update':
          validation = this.validateReviewForUpdate(item, options);
          break;
        case 'moderate':
          validation = this.validateModerationData(item);
          break;
        default:
          errors.push(`Unknown bulk operation: ${operation}`);
          continue;
      }

      if (!validation.valid) {
        errors.push(`Item ${i + 1}: ${validation.errors.join('; ')}`);
        validation.detailedErrors.forEach((err) => {
          detailedErrors.push({
            ...err,
            itemIndex: i,
            message: `Item ${i + 1}: ${err.message}`,
          });
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detailedErrors,
    };
  }
}

export default ReviewValidationUtility;
