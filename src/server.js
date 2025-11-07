/**
 * Server Bootstrap
 * Loads environment variables BEFORE importing app modules
 * This prevents module initialization race conditions with dotenv
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

async function startServer() {
  try {
    // Start the application (imports app.js after env vars are loaded)
    await import('./app.js');
  } catch (error) {
    console.error('❌ Failed to start review service:', error.message);
    process.exit(1);
  }
}

startServer();
