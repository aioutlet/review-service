/**
 * Dapr Secret Management Service
 * Provides secret management using Dapr's secret store building block.
 */

import { DaprClient } from '@dapr/dapr';
import { logger } from '../core/logger.js';
import config from '../core/config.js';

class DaprSecretManager {
  constructor() {
    this.environment = config.env;
    this.daprHost = process.env.DAPR_HOST || '127.0.0.1';
    this.daprPort = process.env.DAPR_HTTP_PORT || '3501';

    // Use appropriate secret store based on environment
    if (this.environment === 'production') {
      this.secretStoreName = 'azure-keyvault-secret-store';
    } else {
      this.secretStoreName = 'local-secret-store';
    }

    this.client = new DaprClient({
      daprHost: this.daprHost,
      daprPort: this.daprPort,
    });

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      daprEnabled: true,
      environment: this.environment,
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value from Dapr secret store
   * @param {string} secretName - Name of the secret to retrieve
   * @returns {Promise<string>} Secret value
   */
  async getSecret(secretName) {
    try {
      const response = await this.client.secret.get(this.secretStoreName, secretName);

      // Handle different response types
      if (response && typeof response === 'object') {
        // Response is typically an object like { secretName: 'value' }
        const value = response[secretName];
        if (value !== undefined && value !== null) {
          logger.debug('Retrieved secret from Dapr', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(value);
        }

        // If not found by key, try getting first value
        const values = Object.values(response);
        if (values.length > 0 && values[0] !== undefined) {
          logger.debug('Retrieved secret from Dapr (first value)', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(values[0]);
        }
      }

      throw new Error(`Secret '${secretName}' not found in Dapr store`);
    } catch (error) {
      logger.error(`Failed to get secret from Dapr: ${error.message}`, {
        event: 'secret_retrieval_error',
        secretName,
        error: error.message,
        store: this.secretStoreName,
      });
      throw error;
    }
  }

  /**
   * Get multiple secrets at once
   * @param {string[]} secretNames - List of secret names to retrieve
   * @returns {Promise<Object>} Object mapping secret names to their values
   */
  async getMultipleSecrets(secretNames) {
    const secrets = {};
    for (const name of secretNames) {
      secrets[name] = await this.getSecret(name);
    }
    return secrets;
  }

  /**
   * Get database configuration from secrets or environment variables
   * @returns {Promise<Object>} Database connection parameters
   */
  async getDatabaseConfig() {
    const [host, port, username, password, database, authSource] = await Promise.all([
      this.getSecret('MONGODB_HOST'),
      this.getSecret('MONGODB_PORT'),
      this.getSecret('MONGO_INITDB_ROOT_USERNAME'),
      this.getSecret('MONGO_INITDB_ROOT_PASSWORD'),
      this.getSecret('MONGO_INITDB_DATABASE'),
      this.getSecret('MONGODB_AUTH_SOURCE'),
    ]);

    return {
      host: host || '127.0.0.1',
      port: parseInt(port || '27017', 10),
      username: username || null,
      password: password || null,
      database: database || 'aioutlet_reviews',
      authSource: authSource || 'admin',
    };
  }

  /**
   * Get JWT configuration from secrets or environment variables
   * @returns {Promise<Object>} JWT configuration parameters
   */
  async getJwtConfig() {
    const [secret, algorithm] = await Promise.all([this.getSecret('JWT_SECRET'), this.getSecret('JWT_ALGORITHM')]);

    return {
      secret: secret || 'your-secret-key',
      algorithm: algorithm || 'HS256',
    };
  }
}

// Global instance
export const secretManager = new DaprSecretManager();

// Helper functions for easy access
export const getDatabaseConfig = () => secretManager.getDatabaseConfig();
export const getJwtConfig = () => secretManager.getJwtConfig();
