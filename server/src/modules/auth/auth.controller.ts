import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { metrics } from '../../infrastructure/observability/observability';
import { env } from '../../config/env';

const refreshCookie = 'skillswap.refresh';
const cookieValue = (req: Request) => req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${refreshCookie}=`))?.slice(refreshCookie.length + 1);
const setRefreshCookie = (res: Response, token: string) => {
  const secure = env.nodeEnv === 'development' || env.nodeEnv === 'test' ? '' : '; Secure';
  res.setHeader('Set-Cookie', `${refreshCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800${secure}`);
};
const clearRefreshCookie = (res: Response) => res.setHeader('Set-Cookie', `${refreshCookie}=; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=0`);

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const user = await authService.registerUser({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: { user },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while registering the user.',
        },
      });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const result = await authService.loginUser({
        email: req.body.email,
        password: req.body.password,
      });
      setRefreshCookie(res, result.refreshToken);
      const { refreshToken: _refreshToken, ...safeResult } = result;

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: safeResult,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        metrics.authFailure('invalid_credentials');
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
      }

      if (error instanceof Error && error.message === 'ACCOUNT_DISABLED') {
        metrics.authFailure('account_disabled');
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'This account is disabled and cannot log in.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while signing you in.',
        },
      });
    }
  },

  refresh: async (req: Request, res: Response) => {
    try {
      const result = await authService.refreshUserSession({
        refreshToken: req.body.refreshToken ?? cookieValue(req) ?? '',
      });
      setRefreshCookie(res, result.refreshToken);
      const { refreshToken: _refreshToken, ...safeResult } = result;

      return res.status(200).json({
        success: true,
        message: 'Refresh successful.',
        data: safeResult,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'REFRESH_TOKEN_REVOKED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REVOKED',
            message: 'This refresh token has been revoked and cannot be used again.',
          },
        });
      }

      if (error instanceof Error && error.message === 'REFRESH_TOKEN_EXPIRED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'The refresh token has expired. Please log in again.',
          },
        });
      }

      if (error instanceof Error && error.message === 'REFRESH_TOKEN_REUSED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REUSED',
            message: 'This refresh token has already been used or is invalid.',
          },
        });
      }

      if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'The refresh token is invalid.',
          },
        });
      }

      if (error instanceof Error && error.message === 'ACCOUNT_DISABLED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'This account is disabled and cannot refresh sessions.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while refreshing the session.',
        },
      });
    }
  },

  logout: async (req: Request, res: Response) => {
    try {
      await authService.logoutUser({ refreshToken: req.body.refreshToken ?? cookieValue(req) ?? '' });
      clearRefreshCookie(res);

      return res.status(200).json({
        success: true,
        message: 'Logout successful.',
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'REFRESH_TOKEN_REVOKED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REVOKED',
            message: 'This refresh token has already been revoked.',
          },
        });
      }

      if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'The refresh token is invalid.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while logging out.',
        },
      });
    }
  },

  logoutAll: async (req: Request, res: Response) => {
    try {
      const result = await authService.logoutAllUserSessions(req.user?.id ?? '');

      return res.status(200).json({
        success: true,
        message: 'All sessions logged out successfully.',
        data: result,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while logging out all sessions.',
        },
      });
    }
  },

  me: async (req: Request, res: Response) => {
    try {
      const user = await authService.getCurrentUser(req.user?.id ?? '');

      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'The authenticated user could not be found.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the current user.',
        },
      });
    }
  },

  verifyEmail: async (req: Request, res: Response) => {
    try {
      const result = await authService.verifyEmailAddress({ token: req.body.token });

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully.',
        data: { verified: result.verified, email: result.email },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_VERIFICATION_TOKEN') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_VERIFICATION_TOKEN',
            message: 'The verification token is invalid or has already been used.',
          },
        });
      }

      if (error instanceof Error && error.message === 'VERIFICATION_TOKEN_EXPIRED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'VERIFICATION_TOKEN_EXPIRED',
            message: 'The verification token has expired. Please request a new one.',
          },
        });
      }

      if (error instanceof Error && error.message === 'VERIFICATION_TOKEN_USED') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'VERIFICATION_TOKEN_USED',
            message: 'This verification token has already been used.',
          },
        });
      }

      if (error instanceof Error && error.message === 'EMAIL_ALREADY_VERIFIED') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_VERIFIED',
            message: 'This email is already verified.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while verifying the email.',
        },
      });
    }
  },

  resendVerification: async (req: Request, res: Response) => {
    try {
      const result = await authService.requestEmailVerification({ email: req.body.email });

      return res.status(200).json({
        success: true,
        message: 'Verification email sent.',
        data: { email: result.email },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No user was found with that email address.',
          },
        });
      }

      if (error instanceof Error && error.message === 'EMAIL_ALREADY_VERIFIED') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_VERIFIED',
            message: 'This email address has already been verified.',
          },
        });
      }

      if (error instanceof Error && error.message === 'VERIFICATION_RESEND_RATE_LIMITED') {
        return res.status(429).json({
          success: false,
          error: {
            code: 'VERIFICATION_RESEND_RATE_LIMITED',
            message: 'Please wait before requesting another verification email.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while resending the verification email.',
        },
      });
    }
  },

  forgotPassword: async (req: Request, res: Response) => {
    try {
      const result = await authService.requestPasswordReset({ email: req.body.email });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: { email: result.email },
      });
    } catch (error: unknown) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while processing the password reset request.',
        },
      });
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    try {
      const result = await authService.resetPassword({
        token: req.body.token,
        password: req.body.password,
      });

      return res.status(200).json({
        success: true,
        message: 'Password reset successful.',
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_RESET_TOKEN') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_RESET_TOKEN',
            message: 'The password reset token is invalid or has already been used.',
          },
        });
      }

      if (error instanceof Error && error.message === 'RESET_TOKEN_EXPIRED') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'RESET_TOKEN_EXPIRED',
            message: 'The password reset token has expired. Please request a new one.',
          },
        });
      }

      if (error instanceof Error && error.message === 'RESET_TOKEN_USED') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'RESET_TOKEN_USED',
            message: 'This password reset token has already been used.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while resetting the password.',
        },
      });
    }
  },
};
