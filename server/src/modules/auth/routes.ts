import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { authController } from './auth.controller';
import { forgotPasswordSchema, loginSchema, refreshTokenSchema, registerSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema } from './auth.validation';
import { metrics } from '../../infrastructure/observability/observability';

const createAuthRateLimiter = (max: number) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? 'unknown')}:${req.path}`,
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

const credentialRateLimiter = createAuthRateLimiter(10);
const sessionRateLimiter = createAuthRateLimiter(60);

export const createAuthRouter = () => {
  const router = Router();

  router.post('/register', credentialRateLimiter, validateBody(registerSchema), authController.register);
  router.post('/login', credentialRateLimiter, validateBody(loginSchema), authController.login);
  router.post('/refresh', sessionRateLimiter, validateBody(refreshTokenSchema), authController.refresh);
  router.post('/logout', sessionRateLimiter, validateBody(refreshTokenSchema), authController.logout);
  router.post('/logout-all', sessionRateLimiter, requireAuth, authController.logoutAll);
  router.get('/me', sessionRateLimiter, requireAuth, authController.me);
  router.post('/verify-email', credentialRateLimiter, validateBody(verifyEmailSchema), authController.verifyEmail);
  router.post('/resend-verification', credentialRateLimiter, validateBody(resendVerificationSchema), authController.resendVerification);
  router.post('/forgot-password', credentialRateLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
  router.post('/reset-password', credentialRateLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

  return router;
};
