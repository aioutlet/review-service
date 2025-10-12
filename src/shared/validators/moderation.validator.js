import mongoose from 'mongoose';

/**
 * Moderation validation utility
 * Provides validation functions for content moderation operations
 */
const moderationValidator = {
  /**
   * Validates MongoDB ObjectId
   * @param {string} id - The ID to validate
   * @returns {boolean} - True if valid ObjectId
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },

  /**
   * Validates moderation action
   * @param {string} action - The moderation action to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidModerationAction(action) {
    if (typeof action !== 'string') {
      return { valid: false, error: 'Moderation action must be a string' };
    }

    const validActions = ['approve', 'reject', 'flag', 'unflag', 'delete', 'edit'];
    if (!validActions.includes(action.toLowerCase())) {
      return { valid: false, error: `Moderation action must be one of: ${validActions.join(', ')}` };
    }

    return { valid: true };
  },

  /**
   * Validates moderation reason
   * @param {string} reason - The moderation reason to validate
   * @param {boolean} required - Whether reason is required
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidModerationReason(reason, required = false) {
    if (!reason && required) {
      return { valid: false, error: 'Moderation reason is required' };
    }

    if (!reason && !required) {
      return { valid: true };
    }

    if (typeof reason !== 'string') {
      return { valid: false, error: 'Moderation reason must be a string' };
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      return { valid: false, error: 'Moderation reason must be at least 5 characters long' };
    }

    if (trimmedReason.length > 1000) {
      return { valid: false, error: 'Moderation reason must not exceed 1000 characters' };
    }

    return { valid: true };
  },

  /**
   * Validates flag reason
   * @param {string} reason - The flag reason to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidFlagReason(reason) {
    if (typeof reason !== 'string') {
      return { valid: false, error: 'Flag reason must be a string' };
    }

    const validReasons = [
      'spam',
      'inappropriate',
      'fake',
      'irrelevant',
      'offensive',
      'harassment',
      'hate_speech',
      'violence',
      'adult_content',
      'copyright',
      'other',
    ];

    if (!validReasons.includes(reason.toLowerCase())) {
      return { valid: false, error: `Flag reason must be one of: ${validReasons.join(', ')}` };
    }

    return { valid: true };
  },

  /**
   * Validates flag description
   * @param {string} description - The flag description to validate
   * @param {boolean} required - Whether description is required
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidFlagDescription(description, required = false) {
    if (!description && required) {
      return { valid: false, error: 'Flag description is required' };
    }

    if (!description && !required) {
      return { valid: true };
    }

    if (typeof description !== 'string') {
      return { valid: false, error: 'Flag description must be a string' };
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 500) {
      return { valid: false, error: 'Flag description must not exceed 500 characters' };
    }

    return { valid: true };
  },

  /**
   * Validates moderation priority
   * @param {string|number} priority - The priority to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidModerationPriority(priority) {
    if (priority === undefined || priority === null) {
      return { valid: true }; // Priority is optional
    }

    // Accept both string and number
    let priorityValue;
    if (typeof priority === 'string') {
      const validStringPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validStringPriorities.includes(priority.toLowerCase())) {
        return { valid: false, error: 'Priority must be one of: low, medium, high, urgent' };
      }
      return { valid: true };
    }

    if (typeof priority === 'number') {
      priorityValue = priority;
    } else {
      priorityValue = parseInt(priority, 10);
    }

    if (isNaN(priorityValue) || priorityValue < 1 || priorityValue > 5) {
      return { valid: false, error: 'Priority must be a number between 1 and 5' };
    }

    return { valid: true };
  },

  /**
   * Validates moderation status
   * @param {string} status - The status to validate
   * @returns {boolean} - True if valid status
   */
  isValidModerationStatus(status) {
    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed', 'escalated'];
    return typeof status === 'string' && validStatuses.includes(status.toLowerCase());
  },

  /**
   * Validates batch moderation data
   * @param {Array} items - The batch items to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidBatchModeration(items) {
    if (!Array.isArray(items)) {
      return { valid: false, error: 'Batch moderation items must be an array' };
    }

    if (items.length === 0) {
      return { valid: false, error: 'At least one item must be provided for batch moderation' };
    }

    if (items.length > 100) {
      return { valid: false, error: 'Maximum 100 items can be processed in a single batch' };
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item || typeof item !== 'object') {
        return { valid: false, error: `Item ${i + 1}: Must be an object` };
      }

      if (!this.isValidObjectId(item.reviewId)) {
        return { valid: false, error: `Item ${i + 1}: Invalid review ID` };
      }

      const actionValidation = this.isValidModerationAction(item.action);
      if (!actionValidation.valid) {
        return { valid: false, error: `Item ${i + 1}: ${actionValidation.error}` };
      }

      if (item.reason) {
        const reasonValidation = this.isValidModerationReason(item.reason);
        if (!reasonValidation.valid) {
          return { valid: false, error: `Item ${i + 1}: ${reasonValidation.error}` };
        }
      }
    }

    return { valid: true };
  },

  /**
   * Validates auto-moderation rules
   * @param {Object} rules - The moderation rules to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidAutoModerationRules(rules) {
    if (!rules || typeof rules !== 'object') {
      return { valid: false, error: 'Auto-moderation rules must be an object' };
    }

    // Validate spam detection rules
    if (rules.spam) {
      if (typeof rules.spam !== 'object') {
        return { valid: false, error: 'Spam rules must be an object' };
      }

      if (rules.spam.enabled !== undefined && typeof rules.spam.enabled !== 'boolean') {
        return { valid: false, error: 'Spam detection enabled flag must be a boolean' };
      }

      if (rules.spam.threshold !== undefined) {
        const threshold = parseFloat(rules.spam.threshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 1) {
          return { valid: false, error: 'Spam threshold must be a number between 0 and 1' };
        }
      }
    }

    // Validate sentiment rules
    if (rules.sentiment) {
      if (typeof rules.sentiment !== 'object') {
        return { valid: false, error: 'Sentiment rules must be an object' };
      }

      if (rules.sentiment.autoRejectThreshold !== undefined) {
        const threshold = parseFloat(rules.sentiment.autoRejectThreshold);
        if (isNaN(threshold) || threshold < -1 || threshold > 1) {
          return { valid: false, error: 'Sentiment auto-reject threshold must be a number between -1 and 1' };
        }
      }

      if (rules.sentiment.autoApproveThreshold !== undefined) {
        const threshold = parseFloat(rules.sentiment.autoApproveThreshold);
        if (isNaN(threshold) || threshold < -1 || threshold > 1) {
          return { valid: false, error: 'Sentiment auto-approve threshold must be a number between -1 and 1' };
        }
      }
    }

    // Validate keyword rules
    if (rules.keywords) {
      if (typeof rules.keywords !== 'object') {
        return { valid: false, error: 'Keyword rules must be an object' };
      }

      if (rules.keywords.blocked && !Array.isArray(rules.keywords.blocked)) {
        return { valid: false, error: 'Blocked keywords must be an array' };
      }

      if (rules.keywords.flagged && !Array.isArray(rules.keywords.flagged)) {
        return { valid: false, error: 'Flagged keywords must be an array' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates moderation queue filters
   * @param {Object} filters - The filter parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidModerationFilters(filters) {
    if (!filters || typeof filters !== 'object') {
      return { valid: true }; // No filters is valid
    }

    // Validate status filter
    if (filters.status && !this.isValidModerationStatus(filters.status)) {
      return { valid: false, error: 'Invalid moderation status in filter' };
    }

    // Validate priority filter
    if (filters.priority) {
      const priorityValidation = this.isValidModerationPriority(filters.priority);
      if (!priorityValidation.valid) {
        return { valid: false, error: priorityValidation.error };
      }
    }

    // Validate moderator filter
    if (filters.moderatorId && typeof filters.moderatorId !== 'string') {
      return { valid: false, error: 'Moderator ID filter must be a string' };
    }

    // Validate date filters
    if (filters.createdAfter) {
      const date = new Date(filters.createdAfter);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Created after date is invalid' };
      }
    }

    if (filters.createdBefore) {
      const date = new Date(filters.createdBefore);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Created before date is invalid' };
      }
    }

    // Validate flag reason filter
    if (filters.flagReason) {
      const reasonValidation = this.isValidFlagReason(filters.flagReason);
      if (!reasonValidation.valid) {
        return { valid: false, error: reasonValidation.error };
      }
    }

    return { valid: true };
  },

  /**
   * Validates escalation data
   * @param {Object} escalation - The escalation data to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidEscalation(escalation) {
    if (!escalation || typeof escalation !== 'object') {
      return { valid: false, error: 'Escalation data is required' };
    }

    // Validate escalation reason
    if (!escalation.reason || typeof escalation.reason !== 'string') {
      return { valid: false, error: 'Escalation reason is required and must be a string' };
    }

    if (escalation.reason.trim().length < 10) {
      return { valid: false, error: 'Escalation reason must be at least 10 characters long' };
    }

    if (escalation.reason.trim().length > 1000) {
      return { valid: false, error: 'Escalation reason must not exceed 1000 characters' };
    }

    // Validate escalation level
    if (escalation.level) {
      const validLevels = ['supervisor', 'manager', 'admin', 'legal'];
      if (!validLevels.includes(escalation.level)) {
        return { valid: false, error: 'Escalation level must be one of: supervisor, manager, admin, legal' };
      }
    }

    // Validate assigned to
    if (escalation.assignedTo && typeof escalation.assignedTo !== 'string') {
      return { valid: false, error: 'Assigned to must be a string (user ID)' };
    }

    return { valid: true };
  },

  /**
   * Validates content sensitivity scoring
   * @param {Object} sensitivity - The sensitivity data to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidSensitivityScore(sensitivity) {
    if (!sensitivity || typeof sensitivity !== 'object') {
      return { valid: true }; // Sensitivity scoring is optional
    }

    // Validate overall score
    if (sensitivity.overall !== undefined) {
      const score = parseFloat(sensitivity.overall);
      if (isNaN(score) || score < 0 || score > 1) {
        return { valid: false, error: 'Overall sensitivity score must be a number between 0 and 1' };
      }
    }

    // Validate category scores
    const validCategories = ['adult', 'violence', 'hate', 'harassment', 'spam', 'fake'];
    for (const category of validCategories) {
      if (sensitivity[category] !== undefined) {
        const score = parseFloat(sensitivity[category]);
        if (isNaN(score) || score < 0 || score > 1) {
          return { valid: false, error: `${category} sensitivity score must be a number between 0 and 1` };
        }
      }
    }

    return { valid: true };
  },
};

export default moderationValidator;
