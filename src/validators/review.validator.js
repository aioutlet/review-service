import mongoose from 'mongoose';

/**
 * Review input validation utility
 * Provides validation functions for review-related data
 */
const reviewValidator = {
  /**
   * Validates MongoDB ObjectId
   * @param {string} id - The ID to validate
   * @returns {boolean} - True if valid ObjectId
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },

  /**
   * Validates user ID format
   * @param {string} userId - The user ID to validate
   * @returns {boolean} - True if valid user ID
   */
  isValidUserId(userId) {
    return typeof userId === 'string' && userId.trim().length > 0 && userId.trim().length <= 100;
  },

  /**
   * Validates product ID format
   * @param {string} productId - The product ID to validate
   * @returns {boolean} - True if valid product ID
   */
  isValidProductId(productId) {
    return typeof productId === 'string' && productId.trim().length > 0 && productId.trim().length <= 100;
  },

  /**
   * Validates review rating
   * @param {number} rating - The rating to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidRating(rating) {
    if (typeof rating !== 'number') {
      return { valid: false, error: 'Rating must be a number' };
    }
    if (!Number.isInteger(rating)) {
      return { valid: false, error: 'Rating must be an integer' };
    }
    if (rating < 1 || rating > 5) {
      return { valid: false, error: 'Rating must be between 1 and 5' };
    }
    return { valid: true };
  },

  /**
   * Validates review title
   * @param {string} title - The title to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidTitle(title) {
    if (typeof title !== 'string') {
      return { valid: false, error: 'Title must be a string' };
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      return { valid: false, error: 'Title must be at least 5 characters long' };
    }
    if (trimmedTitle.length > 200) {
      return { valid: false, error: 'Title must not exceed 200 characters' };
    }
    // Check for inappropriate content patterns
    if (/[<>{}[\]\\\/\^\$\|\?\*\+\(\)]/g.test(trimmedTitle)) {
      return { valid: false, error: 'Title contains invalid characters' };
    }
    return { valid: true };
  },

  /**
   * Validates review content
   * @param {string} content - The content to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidContent(content) {
    if (typeof content !== 'string') {
      return { valid: false, error: 'Content must be a string' };
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      return { valid: false, error: 'Content must be at least 10 characters long' };
    }
    if (trimmedContent.length > 2000) {
      return { valid: false, error: 'Content must not exceed 2000 characters' };
    }
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{10,}/g, // Repeated characters
      /https?:\/\/[^\s]+/gi, // URLs (basic check)
      /\b(buy|cheap|discount|sale|offer|deal|free|money|cash|prize|winner|click here|visit now)\b/gi,
    ];
    for (const pattern of spamPatterns) {
      if (pattern.test(trimmedContent)) {
        return { valid: false, error: 'Content appears to contain spam or promotional material' };
      }
    }
    return { valid: true };
  },

  /**
   * Validates review status
   * @param {string} status - The status to validate
   * @returns {boolean} - True if valid status
   */
  isValidStatus(status) {
    const validStatuses = ['pending', 'approved', 'rejected', 'flagged'];
    return typeof status === 'string' && validStatuses.includes(status.toLowerCase());
  },

  /**
   * Validates vote type
   * @param {string} voteType - The vote type to validate
   * @returns {boolean} - True if valid vote type
   */
  isValidVoteType(voteType) {
    const validVoteTypes = ['helpful', 'notHelpful', 'spam'];
    return typeof voteType === 'string' && validVoteTypes.includes(voteType);
  },

  /**
   * Validates flag reason
   * @param {string} reason - The flag reason to validate
   * @returns {boolean} - True if valid reason
   */
  isValidFlagReason(reason) {
    const validReasons = ['spam', 'inappropriate', 'fake', 'irrelevant', 'other'];
    return typeof reason === 'string' && validReasons.includes(reason.toLowerCase());
  },

  /**
   * Validates flag description
   * @param {string} description - The flag description to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidFlagDescription(description) {
    if (description && typeof description !== 'string') {
      return { valid: false, error: 'Flag description must be a string' };
    }
    if (description && description.trim().length > 500) {
      return { valid: false, error: 'Flag description must not exceed 500 characters' };
    }
    return { valid: true };
  },

  /**
   * Validates sentiment data
   * @param {Object} sentiment - The sentiment object to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidSentiment(sentiment) {
    if (!sentiment || typeof sentiment !== 'object') {
      return { valid: false, error: 'Sentiment must be an object' };
    }

    // Validate score (-1 to 1)
    if (typeof sentiment.score !== 'number' || sentiment.score < -1 || sentiment.score > 1) {
      return { valid: false, error: 'Sentiment score must be a number between -1 and 1' };
    }

    // Validate magnitude (0 to 1)
    if (typeof sentiment.magnitude !== 'number' || sentiment.magnitude < 0 || sentiment.magnitude > 1) {
      return { valid: false, error: 'Sentiment magnitude must be a number between 0 and 1' };
    }

    // Validate label
    const validLabels = ['positive', 'negative', 'neutral', 'mixed'];
    if (!validLabels.includes(sentiment.label)) {
      return { valid: false, error: 'Sentiment label must be one of: positive, negative, neutral, mixed' };
    }

    return { valid: true };
  },

  /**
   * Validates review metadata
   * @param {Object} metadata - The metadata object to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return { valid: true }; // Metadata is optional
    }

    // Validate userAgent
    if (metadata.userAgent && typeof metadata.userAgent !== 'string') {
      return { valid: false, error: 'User agent must be a string' };
    }

    // Validate ipAddress
    if (metadata.ipAddress && typeof metadata.ipAddress !== 'string') {
      return { valid: false, error: 'IP address must be a string' };
    }

    // Validate source
    if (metadata.source) {
      const validSources = ['web', 'mobile', 'api', 'import'];
      if (!validSources.includes(metadata.source)) {
        return { valid: false, error: 'Source must be one of: web, mobile, api, import' };
      }
    }

    // Validate deviceType
    if (metadata.deviceType) {
      const validDeviceTypes = ['desktop', 'tablet', 'smartphone', 'unknown'];
      if (!validDeviceTypes.includes(metadata.deviceType)) {
        return { valid: false, error: 'Device type must be one of: desktop, tablet, smartphone, unknown' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates search and filter parameters
   * @param {Object} params - The parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidSearchParams(params) {
    if (!params || typeof params !== 'object') {
      return { valid: true }; // No params is valid
    }

    // Validate page
    if (params.page !== undefined) {
      const page = parseInt(params.page, 10);
      if (isNaN(page) || page < 1 || page > 10000) {
        return { valid: false, error: 'Page must be a number between 1 and 10000' };
      }
    }

    // Validate limit
    if (params.limit !== undefined) {
      const limit = parseInt(params.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return { valid: false, error: 'Limit must be a number between 1 and 100' };
      }
    }

    // Validate sort
    if (params.sort) {
      const validSorts = ['newest', 'oldest', 'rating_high', 'rating_low', 'helpful', 'verified'];
      if (!validSorts.includes(params.sort)) {
        return {
          valid: false,
          error: 'Sort must be one of: newest, oldest, rating_high, rating_low, helpful, verified',
        };
      }
    }

    // Validate rating filter
    if (params.rating !== undefined) {
      const rating = parseInt(params.rating, 10);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return { valid: false, error: 'Rating filter must be a number between 1 and 5' };
      }
    }

    // Validate verified filter
    if (params.verified !== undefined) {
      if (
        params.verified !== 'true' &&
        params.verified !== 'false' &&
        params.verified !== true &&
        params.verified !== false
      ) {
        return { valid: false, error: 'Verified filter must be true or false' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates moderation action
   * @param {string} action - The moderation action to validate
   * @returns {boolean} - True if valid action
   */
  isValidModerationAction(action) {
    const validActions = ['approve', 'reject', 'flag', 'unflag'];
    return typeof action === 'string' && validActions.includes(action.toLowerCase());
  },

  /**
   * Validates moderation reason
   * @param {string} reason - The moderation reason to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidModerationReason(reason) {
    if (!reason || typeof reason !== 'string') {
      return { valid: false, error: 'Moderation reason is required and must be a string' };
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      return { valid: false, error: 'Moderation reason must be at least 5 characters long' };
    }
    if (trimmedReason.length > 500) {
      return { valid: false, error: 'Moderation reason must not exceed 500 characters' };
    }
    return { valid: true };
  },
};

export default reviewValidator;
