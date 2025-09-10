import mongoose from 'mongoose';

/**
 * Analytics validation utility
 * Provides validation functions for analytics-related data and queries
 */
const analyticsValidator = {
  /**
   * Validates MongoDB ObjectId
   * @param {string} id - The ID to validate
   * @returns {boolean} - True if valid ObjectId
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },

  /**
   * Validates date range parameters
   * @param {string|Date} startDate - The start date
   * @param {string|Date} endDate - The end date
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidDateRange(startDate, endDate) {
    let start, end;

    // Parse start date
    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return { valid: false, error: 'Start date is invalid' };
      }
    }

    // Parse end date
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return { valid: false, error: 'End date is invalid' };
      }
    }

    // Validate range logic
    if (start && end && start > end) {
      return { valid: false, error: 'Start date must be before end date' };
    }

    // Validate against future dates
    const now = new Date();
    if (start && start > now) {
      return { valid: false, error: 'Start date cannot be in the future' };
    }
    if (end && end > now) {
      return { valid: false, error: 'End date cannot be in the future' };
    }

    // Validate maximum range (e.g., 1 year)
    if (start && end) {
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      if (end - start > maxRange) {
        return { valid: false, error: 'Date range cannot exceed 1 year' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates time period parameter
   * @param {string} period - The time period to validate
   * @returns {boolean} - True if valid period
   */
  isValidTimePeriod(period) {
    const validPeriods = ['7d', '30d', '90d', '1y', 'all'];
    return typeof period === 'string' && validPeriods.includes(period.toLowerCase());
  },

  /**
   * Validates grouping parameter for analytics
   * @param {string} groupBy - The grouping parameter to validate
   * @returns {boolean} - True if valid groupBy
   */
  isValidGroupBy(groupBy) {
    const validGroupings = ['day', 'week', 'month', 'quarter', 'year', 'rating', 'status'];
    return typeof groupBy === 'string' && validGroupings.includes(groupBy.toLowerCase());
  },

  /**
   * Validates metrics array
   * @param {Array} metrics - The metrics array to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidMetrics(metrics) {
    if (!Array.isArray(metrics)) {
      return { valid: false, error: 'Metrics must be an array' };
    }

    const validMetrics = [
      'totalReviews',
      'averageRating',
      'ratingDistribution',
      'sentimentAnalysis',
      'verifiedReviews',
      'helpfulVotes',
      'flaggedReviews',
      'responseRate',
      'engagementRate',
    ];

    for (const metric of metrics) {
      if (typeof metric !== 'string' || !validMetrics.includes(metric)) {
        return { valid: false, error: `Invalid metric: ${metric}. Valid metrics are: ${validMetrics.join(', ')}` };
      }
    }

    if (metrics.length === 0) {
      return { valid: false, error: 'At least one metric must be specified' };
    }

    if (metrics.length > 10) {
      return { valid: false, error: 'Maximum 10 metrics can be requested at once' };
    }

    return { valid: true };
  },

  /**
   * Validates pagination parameters for analytics
   * @param {Object} params - The pagination parameters
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidPagination(params) {
    if (!params || typeof params !== 'object') {
      return { valid: true }; // No pagination is valid
    }

    // Validate page
    if (params.page !== undefined) {
      const page = parseInt(params.page, 10);
      if (isNaN(page) || page < 1 || page > 1000) {
        return { valid: false, error: 'Page must be a number between 1 and 1000' };
      }
    }

    // Validate limit
    if (params.limit !== undefined) {
      const limit = parseInt(params.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        return { valid: false, error: 'Limit must be a number between 1 and 1000' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates filter parameters for analytics
   * @param {Object} filters - The filter parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidFilters(filters) {
    if (!filters || typeof filters !== 'object') {
      return { valid: true }; // No filters is valid
    }

    // Validate product filters
    if (filters.productIds && !Array.isArray(filters.productIds)) {
      return { valid: false, error: 'Product IDs filter must be an array' };
    }

    if (filters.productIds && filters.productIds.length > 100) {
      return { valid: false, error: 'Maximum 100 product IDs can be filtered at once' };
    }

    // Validate user filters
    if (filters.userIds && !Array.isArray(filters.userIds)) {
      return { valid: false, error: 'User IDs filter must be an array' };
    }

    if (filters.userIds && filters.userIds.length > 100) {
      return { valid: false, error: 'Maximum 100 user IDs can be filtered at once' };
    }

    // Validate rating filter
    if (filters.minRating !== undefined) {
      const rating = parseFloat(filters.minRating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return { valid: false, error: 'Minimum rating must be a number between 1 and 5' };
      }
    }

    if (filters.maxRating !== undefined) {
      const rating = parseFloat(filters.maxRating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return { valid: false, error: 'Maximum rating must be a number between 1 and 5' };
      }
    }

    // Validate sentiment filter
    if (filters.sentiment) {
      const validSentiments = ['positive', 'negative', 'neutral', 'mixed'];
      if (!validSentiments.includes(filters.sentiment)) {
        return { valid: false, error: 'Sentiment filter must be one of: positive, negative, neutral, mixed' };
      }
    }

    // Validate status filter
    if (filters.status) {
      const validStatuses = ['pending', 'approved', 'rejected', 'flagged'];
      if (!validStatuses.includes(filters.status)) {
        return { valid: false, error: 'Status filter must be one of: pending, approved, rejected, flagged' };
      }
    }

    // Validate verified filter
    if (filters.verified !== undefined) {
      if (typeof filters.verified !== 'boolean') {
        return { valid: false, error: 'Verified filter must be a boolean' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates trending algorithm parameters
   * @param {Object} params - The trending parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidTrendingParams(params) {
    if (!params || typeof params !== 'object') {
      return { valid: true }; // Default params are valid
    }

    // Validate algorithm
    if (params.algorithm) {
      const validAlgorithms = ['wilson', 'bayesian', 'simple_average', 'weighted_average'];
      if (!validAlgorithms.includes(params.algorithm)) {
        return { valid: false, error: 'Algorithm must be one of: wilson, bayesian, simple_average, weighted_average' };
      }
    }

    // Validate minimum reviews threshold
    if (params.minReviews !== undefined) {
      const minReviews = parseInt(params.minReviews, 10);
      if (isNaN(minReviews) || minReviews < 1 || minReviews > 1000) {
        return { valid: false, error: 'Minimum reviews must be a number between 1 and 1000' };
      }
    }

    // Validate time decay factor
    if (params.timeDecay !== undefined) {
      const timeDecay = parseFloat(params.timeDecay);
      if (isNaN(timeDecay) || timeDecay < 0 || timeDecay > 1) {
        return { valid: false, error: 'Time decay must be a number between 0 and 1' };
      }
    }

    // Validate boost factors
    if (params.verifiedBoost !== undefined) {
      const boost = parseFloat(params.verifiedBoost);
      if (isNaN(boost) || boost < 1 || boost > 5) {
        return { valid: false, error: 'Verified boost must be a number between 1 and 5' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates export parameters
   * @param {Object} params - The export parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidExportParams(params) {
    if (!params || typeof params !== 'object') {
      return { valid: false, error: 'Export parameters are required' };
    }

    // Validate format
    const validFormats = ['json', 'csv', 'xlsx'];
    if (!params.format || !validFormats.includes(params.format)) {
      return { valid: false, error: 'Export format must be one of: json, csv, xlsx' };
    }

    // Validate fields
    if (params.fields && !Array.isArray(params.fields)) {
      return { valid: false, error: 'Export fields must be an array' };
    }

    if (params.fields && params.fields.length === 0) {
      return { valid: false, error: 'At least one field must be specified for export' };
    }

    // Validate maximum records
    if (params.maxRecords !== undefined) {
      const maxRecords = parseInt(params.maxRecords, 10);
      if (isNaN(maxRecords) || maxRecords < 1 || maxRecords > 100000) {
        return { valid: false, error: 'Maximum records must be a number between 1 and 100,000' };
      }
    }

    return { valid: true };
  },

  /**
   * Validates comparison parameters
   * @param {Object} params - The comparison parameters to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  isValidComparisonParams(params) {
    if (!params || typeof params !== 'object') {
      return { valid: false, error: 'Comparison parameters are required' };
    }

    // Validate comparison type
    const validTypes = ['period', 'products', 'segments'];
    if (!params.type || !validTypes.includes(params.type)) {
      return { valid: false, error: 'Comparison type must be one of: period, products, segments' };
    }

    // Validate based on comparison type
    switch (params.type) {
      case 'period':
        if (!params.basePeriod || !params.comparePeriod) {
          return { valid: false, error: 'Base period and compare period are required for period comparison' };
        }
        break;
      case 'products':
        if (!params.productIds || !Array.isArray(params.productIds) || params.productIds.length < 2) {
          return { valid: false, error: 'At least 2 product IDs are required for product comparison' };
        }
        if (params.productIds.length > 10) {
          return { valid: false, error: 'Maximum 10 products can be compared at once' };
        }
        break;
      case 'segments':
        if (!params.segments || !Array.isArray(params.segments) || params.segments.length < 2) {
          return { valid: false, error: 'At least 2 segments are required for segment comparison' };
        }
        break;
    }

    return { valid: true };
  },
};

export default analyticsValidator;
