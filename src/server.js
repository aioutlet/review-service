import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module (src/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment configuration
 */
const loadEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  // Always load .env file for local development and debugging
  // User manually manages .env file by copying from .env.development or .env.production as needed
  const envPath = join(__dirname, '..', '.env'); // Go up one level from src/ to project root
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error('❌ Error: Could not load .env file');
    console.error(`Looking for .env file at: ${envPath}`);
    console.error('Please create a .env file in the project root or set environment variables manually');
    process.exit(1);
  } else {
    console.log(`✅ Loaded configuration from .env file (${env} mode)`);
  }
};

// Load environment configuration first
loadEnvironmentConfig();

// Now import and start the application
import('./app.js');
