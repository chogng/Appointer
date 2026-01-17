import express from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.post('/login', loginLimiter, asyncHandler(login));
router.post('/logout', logout);
router.get('/me', authenticateToken, asyncHandler(getMe));

export default router;
