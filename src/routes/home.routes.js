/**
 * Home Routes
 * Routes for service information endpoint
 */

import express from 'express';
import { info } from '../controllers/home.controller.js';

const router = express.Router();

router.get('/', info);

export default router;
