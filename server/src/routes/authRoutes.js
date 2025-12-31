import express from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);

export default router;
