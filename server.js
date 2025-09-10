#!/usr/bin/env node

/**
 * Review Service Server Entry Point
 *
 * This file serves as the main entry point for the review service.
 * It handles environment setup, loads the application, and starts the server.
 */

import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: join(__dirname, '..', envFile) });

// Validate required environment variables
const requiredEnvVars = ['NODE_ENV', 'PORT', 'MONGO_URI', 'REDIS_URL', 'RABBITMQ_URL', 'JWT_SECRET'];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease create a .env file with the required variables.');
  process.exit(1);
}

// Import and start the application
import('./app.js')
  .then((appModule) => {
    // App is started automatically in app.js
    console.log('✅ Review service loaded successfully');
  })
  .catch((error) => {
    console.error('❌ Failed to start review service:', error);
    process.exit(1);
  });
