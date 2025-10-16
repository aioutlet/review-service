import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: process.env.PORT || 9001,
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aioutlet_reviews',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    options: {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    },
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
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
  externalServices: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    productService: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
    orderService: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    reviewCreation: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 reviews per hour
    },
    voting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 votes per 15 minutes
    },
    admin: {
      windowMs: 15 * 60 * 1000,
      max: 200,
    },
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
  },
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  review: {
    maxLength: parseInt(process.env.MAX_REVIEW_LENGTH) || 2000,
    maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH) || 200,
    autoApproveVerified: process.env.AUTO_APPROVE_VERIFIED === 'true',
    moderationRequired: true,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    format: process.env.LOG_FORMAT || 'console',
    enableFile: process.env.LOG_TO_FILE === 'true',
    enableConsole: process.env.LOG_TO_CONSOLE !== 'false',
    enableTracing: process.env.ENABLE_TRACING !== 'false',
  },
  observability: {
    serviceName: process.env.SERVICE_NAME || 'review-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    tracing: {
      enabled: process.env.ENABLE_TRACING !== 'false',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE) || 0.1, // 10% sampling in production
    },
    metrics: {
      enabled: process.env.ENABLE_METRICS !== 'false',
      port: parseInt(process.env.METRICS_PORT) || 9090,
      path: process.env.METRICS_PATH || '/metrics',
    },
    healthCheck: {
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
      gracePeriod: parseInt(process.env.HEALTH_CHECK_GRACE_PERIOD) || 10000,
    },
  },
};

export default config;
