/**
 * Configuration Validator for Review Service
 * Validates application configuration for completeness and production readiness
 */

/**
 * Validate application configuration
 * @param {Object} config - The configuration object to validate
 * @throws {Error} If configuration validation fails
 */
export const validateConfig = (config) => {
  const errors = [];
  const warnings = [];

  // === Database Configuration Validation ===
  if (!config.database?.mongoUri) {
    errors.push('MongoDB URI configuration is missing');
  } else {
    try {
      // Basic URI validation
      new URL(config.database.mongoUri.replace('mongodb://', 'http://').replace('mongodb+srv://', 'http://'));
    } catch {
      errors.push('MongoDB URI format is invalid');
    }
  }

  // === Redis Configuration Validation ===
  if (!config.cache?.redisUrl) {
    errors.push('Redis URL configuration is missing');
  } else {
    try {
      new URL(config.cache.redisUrl.replace('redis://', 'http://').replace('rediss://', 'https://'));
    } catch {
      errors.push('Redis URL format is invalid');
    }
  }

  // === Message Broker Configuration Validation ===
  if (!config.messaging?.rabbitmqUrl) {
    errors.push('RabbitMQ URL configuration is missing');
  } else {
    try {
      new URL(config.messaging.rabbitmqUrl.replace('amqp://', 'http://').replace('amqps://', 'https://'));
    } catch {
      errors.push('RabbitMQ URL format is invalid');
    }
  }

  // === JWT Configuration Validation ===
  if (!config.security?.jwtSecret || config.security.jwtSecret.includes('CHANGE_THIS')) {
    errors.push('JWT_SECRET must be set and not contain default values');
  }

  if (config.security?.jwtSecret && config.security.jwtSecret.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long');
  }

  // Check for common weak secrets
  if (config.security?.jwtSecret) {
    const weakSecrets = ['secret', 'password', '123456', 'jwt_secret', 'change_me'];
    if (weakSecrets.some((weak) => config.security.jwtSecret.toLowerCase().includes(weak))) {
      errors.push('JWT_SECRET appears to be weak - use a strong, random secret');
    }
  }

  // === API Key Configuration ===
  if (!config.security?.apiKey) {
    warnings.push('API_KEY is not configured - internal service communication may fail');
  } else if (config.security.apiKey.length < 16) {
    warnings.push('API_KEY should be at least 16 characters long');
  }

  // === External Services Configuration ===
  const requiredServices = ['userServiceUrl', 'productServiceUrl', 'orderServiceUrl'];
  requiredServices.forEach((service) => {
    if (!config.externalServices?.[service]) {
      warnings.push(`${service} is not configured - related features may not work`);
    } else {
      try {
        new URL(config.externalServices[service]);
      } catch {
        errors.push(`${service} URL format is invalid`);
      }
    }
  });

  // === Security Configuration Validation ===
  if (config.security?.corsOrigin && Array.isArray(config.security.corsOrigin)) {
    const invalidOrigins = config.security.corsOrigin.filter((origin) => {
      if (origin === '*') return false; // Wildcard is valid
      try {
        new URL(origin);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidOrigins.length > 0) {
      errors.push(`Invalid CORS origins: ${invalidOrigins.join(', ')}`);
    }
  }

  // === Rate Limiting Configuration ===
  if (config.rateLimit?.windowMs && (config.rateLimit.windowMs < 1000 || config.rateLimit.windowMs > 3600000)) {
    warnings.push('Rate limit window should be between 1 second and 1 hour');
  }

  if (config.rateLimit?.maxRequests && (config.rateLimit.maxRequests < 1 || config.rateLimit.maxRequests > 10000)) {
    warnings.push('Rate limit max requests should be between 1 and 10,000');
  }

  // === Features Configuration ===
  const featureChecks = {
    enableAnalytics: 'Analytics features',
    enableSentimentAnalysis: 'Sentiment analysis features',
    enableContentModeration: 'Content moderation features',
    enablePurchaseVerification: 'Purchase verification features',
    enableReviewVoting: 'Review voting features',
    enableAutoModeration: 'Auto-moderation features',
  };

  Object.entries(featureChecks).forEach(([key, description]) => {
    if (config.features?.[key] === undefined) {
      warnings.push(`${description} configuration is missing - defaulting to disabled`);
    }
  });

  // === Cache Configuration ===
  const cacheTtlChecks = {
    reviewsTtl: 'Reviews cache TTL',
    ratingsTtl: 'Ratings cache TTL',
    analyticsTtl: 'Analytics cache TTL',
  };

  Object.entries(cacheTtlChecks).forEach(([key, description]) => {
    const ttl = config.cache?.[key];
    if (ttl && (ttl < 60 || ttl > 86400)) {
      warnings.push(`${description} should be between 60 seconds and 24 hours`);
    }
  });

  // === Business Rules Configuration ===
  const businessRules = {
    maxReviewLength: { min: 100, max: 10000, name: 'Maximum review length' },
    minReviewLength: { min: 5, max: 100, name: 'Minimum review length' },
    reviewEditTimeLimit: { min: 300, max: 604800, name: 'Review edit time limit (seconds)' },
  };

  Object.entries(businessRules).forEach(([key, rule]) => {
    const value = config.businessRules?.[key];
    if (value && (value < rule.min || value > rule.max)) {
      warnings.push(`${rule.name} should be between ${rule.min} and ${rule.max}`);
    }
  });

  // === Production-specific validations ===
  if (config.isProduction) {
    if (config.logging?.level === 'debug') {
      warnings.push('LOG_LEVEL should not be debug in production');
    }

    if (!config.security?.enableSecurityHeaders) {
      errors.push('Security headers should be enabled in production');
    }

    // Production should not allow wildcard CORS
    if (config.security?.corsOrigin?.includes('*')) {
      errors.push('CORS_ORIGIN should not include wildcard (*) in production');
    }

    // Production should have proper rate limiting
    if (!config.rateLimit?.maxRequests || config.rateLimit.maxRequests > 1000) {
      warnings.push('Rate limiting should be more restrictive in production');
    }

    // Production should have monitoring enabled
    if (!config.monitoring?.enableMetrics) {
      warnings.push('Metrics collection should be enabled in production');
    }

    // Production should have proper cache TTL values
    if (config.cache?.reviewsTtl && config.cache.reviewsTtl < 300) {
      warnings.push('Reviews cache TTL should be at least 5 minutes in production');
    }
  }

  // === Development-specific validations ===
  if (config.isDevelopment) {
    // Warn about production-like settings in development
    if (config.rateLimit?.maxRequests && config.rateLimit.maxRequests < 100) {
      warnings.push('Rate limiting is quite restrictive for development - this may slow down testing');
    }

    if (config.cache?.reviewsTtl && config.cache.reviewsTtl > 3600) {
      warnings.push('Cache TTL is quite long for development - this may make testing difficult');
    }

    // Recommend mock services for development
    if (!config.features?.devMockExternalServices) {
      warnings.push('Consider enabling devMockExternalServices for easier development');
    }
  }

  // === Health Check Configuration ===
  if (config.healthCheck?.timeout && (config.healthCheck.timeout < 1000 || config.healthCheck.timeout > 30000)) {
    warnings.push('Health check timeout should be between 1 and 30 seconds');
  }

  if (
    config.healthCheck?.gracePeriod &&
    (config.healthCheck.gracePeriod < 5000 || config.healthCheck.gracePeriod > 120000)
  ) {
    warnings.push('Health check grace period should be between 5 seconds and 2 minutes');
  }

  // === Logging Configuration ===
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (config.logging?.level && !validLogLevels.includes(config.logging.level)) {
    errors.push(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }

  // === Sentiment Analysis Configuration ===
  if (config.features?.enableSentimentAnalysis && !config.externalServices?.sentimentApiUrl) {
    warnings.push('Sentiment analysis is enabled but no API URL is configured');
  }

  // === Content Moderation Configuration ===
  if (config.features?.enableContentModeration && !config.externalServices?.moderationApiUrl) {
    warnings.push('Content moderation is enabled but no API URL is configured');
  }

  // Report results
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map((err) => `  - ${err}`).join('\n')}`);
  }

  console.log('✅ Review service configuration validation passed');
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s) found - review configuration for optimal setup`);
  }
};

/**
 * Validates environment-specific configuration
 * @param {string} environment - The environment (development, production, test)
 * @param {Object} config - The configuration object
 */
export const validateEnvironmentConfig = (environment, config) => {
  const errors = [];

  switch (environment) {
    case 'production':
      // Production-specific validations
      if (!config.monitoring?.enableMetrics) {
        errors.push('Metrics should be enabled in production');
      }
      if (config.features?.devMockExternalServices) {
        errors.push('Mock external services should be disabled in production');
      }
      if (config.features?.devBypassAuth) {
        errors.push('Auth bypass should be disabled in production');
      }
      break;

    case 'test':
      // Test-specific validations
      if (!config.database?.testMongoUri) {
        errors.push('Test database URI should be configured for test environment');
      }
      if (!config.cache?.testRedisUrl) {
        errors.push('Test Redis URL should be configured for test environment');
      }
      break;

    case 'development':
      // Development-specific recommendations
      if (!config.features?.devMockExternalServices) {
        console.warn('⚠️  Consider enabling mock external services for easier development');
      }
      break;
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment-specific validation failed for ${environment}:\n${errors.map((err) => `  - ${err}`).join('\n')}`
    );
  }
};

export default {
  validateConfig,
  validateEnvironmentConfig,
};
