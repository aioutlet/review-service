import mongoose from 'mongoose';
import { logger } from '../core/logger.js';
import { secretManager } from '../services/dapr.secretManager.js';

const connectDB = async () => {
  try {
    // Get database configuration from Dapr Secret Manager
    const dbConfig = await secretManager.getDatabaseConfig();

    // Force IPv4 by replacing 'localhost' with '127.0.0.1'
    const host = dbConfig.host === 'localhost' ? '127.0.0.1' : dbConfig.host;

    let mongodb_uri;
    if (dbConfig.username && dbConfig.password) {
      mongodb_uri = `mongodb://${dbConfig.username}:${dbConfig.password}@${host}:${dbConfig.port}/${dbConfig.database}?authSource=${dbConfig.authSource}`;
    } else {
      mongodb_uri = `mongodb://${host}:${dbConfig.port}/${dbConfig.database}`;
    }

    logger.info(`Connecting to MongoDB: ${host}:${dbConfig.port}/${dbConfig.database}`);

    // Set global promise library
    mongoose.Promise = global.Promise;

    // Set strictQuery to false to prepare for Mongoose 7
    mongoose.set('strictQuery', false);

    // Connect to MongoDB with connection options
    const conn = await mongoose.connect(mongodb_uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });

    logger.info(`MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        logger.error(`Error during MongoDB disconnection: ${error.message}`);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    logger.error(`Error occurred while connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

export default connectDB;
