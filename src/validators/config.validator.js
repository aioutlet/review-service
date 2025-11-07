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

  // === Database Configuration ===
  // Note: All database configuration is managed by Dapr Secret Manager
  // No validation needed in config.js

  // === Security Configuration ===
  // Note: JWT secrets are managed by Dapr Secret Manager
  // We only validate CORS and other non-sensitive security settings here
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

    // Production should not allow wildcard CORS
    if (config.env === 'production' && config.security.corsOrigin.includes('*')) {
      errors.push('CORS_ORIGIN should not include wildcard (*) in production');
    }
  }

  // === Logging Configuration ===
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (config.logging?.level && !validLogLevels.includes(config.logging.level)) {
    errors.push(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }

  if (config.env === 'production' && config.logging?.level === 'debug') {
    warnings.push('LOG_LEVEL should not be debug in production');
  }

  // === Server Configuration ===
  if (!config.server?.port) {
    errors.push('Server port is not configured');
  }

  if (!config.server?.host) {
    warnings.push('Server host is not configured - using default');
  }

  // === Dapr Configuration ===
  if (!config.dapr?.httpPort) {
    warnings.push('Dapr HTTP port is not configured - using default');
  }

  if (!config.dapr?.pubsubName) {
    warnings.push('Dapr pubsub name is not configured - using default');
  }

  if (!config.dapr?.appId) {
    warnings.push('Dapr app ID is not configured - using default');
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
      if (config.logging?.level === 'debug') {
        errors.push('Debug logging should not be enabled in production');
      }
      if (config.security?.corsOrigin?.includes('*')) {
        errors.push('Wildcard CORS should not be allowed in production');
      }
      break;

    case 'test':
      // Test-specific validations
      // Note: Test database config is managed by Dapr Secret Manager
      break;

    case 'development':
      // Development-specific recommendations
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
