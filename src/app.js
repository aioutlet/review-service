import express from 'express';
import cors from 'cors';

import { config, logger } from './core/index.js';
import connectDB from './database/database.js';
import correlationIdMiddleware from './middleware/correlationId.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import reviewRoutes from './routes/review.routes.js';
import homeRoutes from './routes/home.routes.js';
import operationalRoutes from './routes/operational.routes.js';

const app = express();
app.set('trust proxy', true);

// Apply CORS before other middlewares
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
  })
);

app.use(correlationIdMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
await connectDB();

// Routes
app.use('/', homeRoutes);
app.use('/', operationalRoutes);
app.use('/api/reviews', reviewRoutes);

// Error handler
app.use(errorHandler);

const PORT = parseInt(process.env.PORT, 10) || 9001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Review service running on ${HOST}:${PORT} in ${process.env.NODE_ENV} mode`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
