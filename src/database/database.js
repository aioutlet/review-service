import mongoose from 'mongoose';
import config from '../core/config.js';
import { logger } from '../core/index.js';
import { secretManager } from '../services/dapr.secretManager.js';

const connectDB = async () => {
  try {
    // Get database configuration from Dapr Secret Manager
    const dbConfig = await secretManager.getDatabaseConfig();

    let mongodb_uri;
    if (dbConfig.username && dbConfig.password) {
      mongodb_uri = `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}?authSource=${dbConfig.authSource}`;
    } else {
      mongodb_uri = `mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
    }

    logger.info(`Connecting to MongoDB: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Set global promise library
    mongoose.Promise = global.Promise;

    // Set strictQuery to false to prepare for Mongoose 7
    mongoose.set('strictQuery', false);

    // Connect to MongoDB with connection options
    const conn = await mongoose.connect(mongodb_uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
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
