import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from '../observability/index.js';
import config from '../config/index.js';

class CacheService {
  constructor() {
    this.defaultTtl = config.cache.ttl;
  }

  /**
   * Get Redis client safely
   * @returns {Object|null} Redis client or null if not connected
   */
  getClient() {
    try {
      if (isRedisConnected()) {
        return getRedisClient();
      }
      return null;
    } catch (error) {
      logger.warn('Redis client not available:', error.message);
      return null;
    }
  }

  /**
   * Generate cache key with prefix
   * @param {String} type - Cache type
   * @param {String} identifier - Unique identifier
   * @returns {String} Cache key
   */
  generateKey(type, identifier) {
    return `review-service:${type}:${identifier}`;
  }

  /**
   * Set cache value with TTL
   * @param {String} key - Cache key
   * @param {Any} value - Value to cache
   * @param {Number} ttl - Time to live in seconds
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async set(key, value, ttl = this.defaultTtl, correlationId) {
    const client = this.getClient();
    if (!client) {
      logger.warn('Cache set failed - Redis not available', { key, correlationId });
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await client.setEx(key, ttl, serializedValue);

      logger.debug('Cache set successful', { key, ttl, correlationId });
      return true;
    } catch (error) {
      logger.error('Cache set failed:', { error: error.message, key, correlationId });
      return false;
    }
  }

  /**
   * Get cache value
   * @param {String} key - Cache key
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Any|null>} Cached value or null
   */
  async get(key, correlationId) {
    const client = this.getClient();
    if (!client) {
      logger.warn('Cache get failed - Redis not available', { key, correlationId });
      return null;
    }

    try {
      const value = await client.get(key);
      if (value) {
        logger.debug('Cache hit', { key, correlationId });
        return JSON.parse(value);
      }

      logger.debug('Cache miss', { key, correlationId });
      return null;
    } catch (error) {
      logger.error('Cache get failed:', { error: error.message, key, correlationId });
      return null;
    }
  }

  /**
   * Delete cache value
   * @param {String} key - Cache key
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async delete(key, correlationId) {
    const client = this.getClient();
    if (!client) {
      logger.warn('Cache delete failed - Redis not available', { key, correlationId });
      return false;
    }

    try {
      await client.del(key);
      logger.debug('Cache delete successful', { key, correlationId });
      return true;
    } catch (error) {
      logger.error('Cache delete failed:', { error: error.message, key, correlationId });
      return false;
    }
  }

  /**
   * Delete multiple cache keys by pattern
   * @param {String} pattern - Key pattern (e.g., "review-service:product:*")
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Number>} Number of deleted keys
   */
  async deleteByPattern(pattern, correlationId) {
    const client = this.getClient();
    if (!client) {
      logger.warn('Cache pattern delete failed - Redis not available', { pattern, correlationId });
      return 0;
    }

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        logger.debug('Cache pattern delete successful', { pattern, deletedCount: keys.length, correlationId });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache pattern delete failed:', { error: error.message, pattern, correlationId });
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {String} key - Cache key
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Existence status
   */
  async exists(key, correlationId) {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check failed:', { error: error.message, key, correlationId });
      return false;
    }
  }

  /**
   * Set cache value if not exists
   * @param {String} key - Cache key
   * @param {Any} value - Value to cache
   * @param {Number} ttl - Time to live in seconds
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status (true if set, false if already exists)
   */
  async setIfNotExists(key, value, ttl = this.defaultTtl, correlationId) {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      const result = await client.set(key, serializedValue, {
        EX: ttl,
        NX: true, // Only set if not exists
      });

      const success = result === 'OK';
      logger.debug('Cache setIfNotExists result', { key, success, correlationId });
      return success;
    } catch (error) {
      logger.error('Cache setIfNotExists failed:', { error: error.message, key, correlationId });
      return false;
    }
  }

  // Product Rating Cache Methods

  // Review List Cache Methods

  /**
   * Cache product reviews list
   * @param {String} productId - Product ID
   * @param {Object} filters - Filter parameters
   * @param {Object} reviewsData - Reviews data with pagination
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async setProductReviews(productId, filters, reviewsData, correlationId) {
    const filterKey = this.generateFilterKey(filters);
    const key = this.generateKey('product-reviews', `${productId}:${filterKey}`);
    return this.set(key, reviewsData, 300, correlationId); // 5 minutes TTL for review lists
  }

  /**
   * Get cached product reviews list
   * @param {String} productId - Product ID
   * @param {Object} filters - Filter parameters
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object|null>} Cached reviews data
   */
  async getProductReviews(productId, filters, correlationId) {
    const filterKey = this.generateFilterKey(filters);
    const key = this.generateKey('product-reviews', `${productId}:${filterKey}`);
    return this.get(key, correlationId);
  }

  /**
   * Delete all cached reviews for a product
   * @param {String} productId - Product ID
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Number>} Number of deleted keys
   */
  async deleteProductReviews(productId, correlationId) {
    const pattern = this.generateKey('product-reviews', `${productId}:*`);
    return this.deleteByPattern(pattern, correlationId);
  }

  // User Cache Methods

  /**
   * Cache user's reviews
   * @param {String} userId - User ID
   * @param {Object} reviewsData - User's reviews data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async setUserReviews(userId, reviewsData, correlationId) {
    const key = this.generateKey('user-reviews', userId);
    return this.set(key, reviewsData, 600, correlationId); // 10 minutes TTL
  }

  /**
   * Get cached user's reviews
   * @param {String} userId - User ID
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object|null>} Cached reviews data
   */
  async getUserReviews(userId, correlationId) {
    const key = this.generateKey('user-reviews', userId);
    return this.get(key, correlationId);
  }

  /**
   * Delete cached user's reviews
   * @param {String} userId - User ID
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteUserReviews(userId, correlationId) {
    const key = this.generateKey('user-reviews', userId);
    return this.delete(key, correlationId);
  }

  // Analytics Cache Methods

  /**
   * Cache analytics data
   * @param {String} type - Analytics type
   * @param {String} identifier - Unique identifier
   * @param {Object} data - Analytics data
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Boolean>} Success status
   */
  async setAnalytics(type, identifier, data, correlationId) {
    const key = this.generateKey('analytics', `${type}:${identifier}`);
    return this.set(key, data, 1800, correlationId); // 30 minutes TTL
  }

  /**
   * Get cached analytics data
   * @param {String} type - Analytics type
   * @param {String} identifier - Unique identifier
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object|null>} Cached analytics data
   */
  async getAnalytics(type, identifier, correlationId) {
    const key = this.generateKey('analytics', `${type}:${identifier}`);
    return this.get(key, correlationId);
  }

  // Rate Limiting Cache Methods

  /**
   * Increment rate limit counter
   * @param {String} identifier - Rate limit identifier (IP, user ID, etc.)
   * @param {String} action - Action type
   * @param {Number} windowSeconds - Time window in seconds
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Number>} Current count
   */
  async incrementRateLimit(identifier, action, windowSeconds, correlationId) {
    const client = this.getClient();
    if (!client) {
      return 0;
    }

    try {
      const key = this.generateKey('rate-limit', `${action}:${identifier}`);
      const current = await client.incr(key);

      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      return current;
    } catch (error) {
      logger.error('Rate limit increment failed:', { error: error.message, identifier, action, correlationId });
      return 0;
    }
  }

  /**
   * Get current rate limit count
   * @param {String} identifier - Rate limit identifier
   * @param {String} action - Action type
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Number>} Current count
   */
  async getRateLimitCount(identifier, action, correlationId) {
    const key = this.generateKey('rate-limit', `${action}:${identifier}`);
    const value = await this.get(key, correlationId);
    return value || 0;
  }

  // Helper Methods

  /**
   * Generate filter key for caching
   * @param {Object} filters - Filter object
   * @returns {String} Filter key
   */
  generateFilterKey(filters) {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((result, key) => {
        result[key] = filters[key];
        return result;
      }, {});

    return Buffer.from(JSON.stringify(sortedFilters)).toString('base64');
  }

  /**
   * Clear all cache
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Number>} Number of deleted keys
   */
  async clearAll(correlationId) {
    const pattern = 'review-service:*';
    return this.deleteByPattern(pattern, correlationId);
  }

  /**
   * Get cache statistics
   * @param {String} correlationId - Request correlation ID
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats(correlationId) {
    const client = this.getClient();
    if (!client) {
      return {
        connected: false,
        totalKeys: 0,
        memory: 0,
        hits: 0,
        misses: 0,
      };
    }

    try {
      const info = await client.info('memory');
      const keyspace = await client.info('keyspace');
      const stats = await client.info('stats');

      // Parse Redis info response
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);

      const keys = await client.keys('review-service:*');

      return {
        connected: true,
        totalKeys: keys.length,
        memory: memoryMatch ? parseInt(memoryMatch[1]) : 0,
        hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
        misses: missesMatch ? parseInt(missesMatch[1]) : 0,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', { error: error.message, correlationId });
      return {
        connected: false,
        error: error.message,
      };
    }
  }
}

export default new CacheService();
