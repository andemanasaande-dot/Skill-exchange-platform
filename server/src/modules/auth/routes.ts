import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { authController } from './auth.controller';
import { forgotPasswordSchema, loginSchema, refreshTokenSchema, registerSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema } from './auth.validation';
import { metrics } from '../../infrastructure/observability/observability';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    metrics.authFailure('rate_limited');
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' } });
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

export const createAuthRouter = () => {
  const router = Router();

  router.post('/register', authRateLimiter, validateBody(registerSchema), authController.register);
  router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
  router.post('/refresh', authRateLimiter, validateBody(refreshTokenSchema), authController.refresh);
  router.post('/logout', authRateLimiter, validateBody(refreshTokenSchema), authController.logout);
  router.post('/logout-all', authRateLimiter, requireAuth, authController.logoutAll);
  router.get('/me', authRateLimiter, requireAuth, authController.me);
  router.post('/verify-email', authRateLimiter, validateBody(verifyEmailSchema), authController.verifyEmail);
  router.post('/resend-verification', authRateLimiter, validateBody(resendVerificationSchema), authController.resendVerification);
  router.post('/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
  router.post('/reset-password', authRateLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

  return router;
};
