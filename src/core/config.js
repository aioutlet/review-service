import dotenv from 'dotenv';

dotenv.config();

const config = {
  serviceName: process.env.SERVICE_NAME || 'review-service',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  env: process.env.NODE_ENV || 'development',
  server: {
    port: process.env.PORT || 9001,
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    // Construct MongoDB URI from environment variables
    // Note: This is the initial config. The actual URI will be constructed
    // using secrets from Dapr Secret Manager when database connects
    uri: (() => {
      const mongoHost = process.env.MONGODB_HOST || 'localhost';
      const mongoPort = process.env.MONGODB_PORT || '27017';
      const mongoUsername = process.env.MONGO_INITDB_ROOT_USERNAME;
      const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;
      const mongoDatabase = process.env.MONGO_INITDB_DATABASE || 'aioutlet_reviews';
      const mongoAuthSource = process.env.MONGODB_AUTH_SOURCE || 'admin';

      if (mongoUsername && mongoPassword) {
        return `mongodb://${mongoUsername}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDatabase}?authSource=${mongoAuthSource}`;
      } else {
        return `mongodb://${mongoHost}:${mongoPort}/${mongoDatabase}`;
      }
    })(),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  service: {
    name: process.env.SERVICE_NAME || 'review-service',
  },
  messaging: {
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchanges: {
      reviews: 'reviews.exchange',
      orders: 'orders.exchange',
      users: 'users.exchange',
      products: 'products.exchange',
    },
    queues: {
      reviewEvents: 'review.events',
      orderCompleted: 'review.order.completed',
      userDeleted: 'review.user.deleted',
      productDeleted: 'review.product.deleted',
    },
  },
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    format: process.env.LOG_FORMAT || 'console',
    enableFile: process.env.LOG_TO_FILE === 'true',
    enableConsole: process.env.LOG_TO_CONSOLE !== 'false',
  },
};

export default config;
