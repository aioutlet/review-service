import { createClient } from 'redis';
import config from './index.js';
import logger from '../observability/index.js';

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  if (isConnected && redisClient?.isOpen) {
    logger.info('Redis already connected');
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      ...config.redis.options,
    });

    // Error handling
    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis connected successfully');
      isConnected = true;
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        if (redisClient?.isOpen) {
          await redisClient.disconnect();
          logger.info('Redis connection closed through app termination');
        }
      } catch (err) {
        logger.error('Error closing Redis connection:', err);
      }
    });

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    isConnected = false;
    throw error;
  }
};

// Helper functions for Redis operations
const getRedisClient = () => {
  if (!redisClient || !isConnected) {
    throw new Error('Redis client not connected');
  }
  return redisClient;
};

const isRedisConnected = () => isConnected && redisClient?.isOpen;

export default connectRedis;
export { getRedisClient, isRedisConnected };
