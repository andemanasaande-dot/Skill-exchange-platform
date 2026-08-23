import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.service';
import prisma from '../infrastructure/database/prisma';
import { log, metrics } from '../infrastructure/observability/observability';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    status?: string;
  };
}

const unauthorizedResponse = (res: Response, message: string) => {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  });
};

const forbiddenResponse = (res: Response, message: string) => {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message,
    },
  });
};

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    metrics.authFailure('missing_bearer');
    return unauthorizedResponse(res, 'Authentication required.');
  }

  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };

    return next();
  } catch (_error) {
    metrics.authFailure('invalid_or_expired');
    return unauthorizedResponse(res, 'Invalid or expired access token.');
  }
};

export const requireAuth = authenticate;

export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      metrics.unauthorized('missing_principal');
      return unauthorizedResponse(res, 'Authentication required.');
    }

    if (!roles.includes(req.user.role ?? '')) {
      metrics.unauthorized('insufficient_role');
      log.warn('Unauthorized role access attempt.', { requiredRoles: roles });
      return forbiddenResponse(res, `This action requires one of the following roles: ${roles.join(', ')}`);
    }

    return next();
  };
};

export const requireActiveUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    metrics.unauthorized('missing_principal');
    return unauthorizedResponse(res, 'Authentication required.');
  }

  if (req.user.status && req.user.status !== 'ACTIVE') {
    metrics.unauthorized('inactive_token');
    return forbiddenResponse(res, 'User account is not active.');
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { status: true, isRestricted: true, role: true } });
    if (!user) {
      metrics.unauthorized('account_not_found');
      return unauthorizedResponse(res, 'User account could not be found.');
    }
    if (user.status !== 'ACTIVE') {
      metrics.unauthorized('inactive_account');
      return forbiddenResponse(res, 'User account is not active.');
    }
    if (user.isRestricted) {
      metrics.unauthorized('restricted_account');
      return forbiddenResponse(res, 'User account is restricted.');
    }
    req.user.role = user.role;
    req.user.status = user.status;
  } catch (_error) {
    metrics.databaseError('active_user_check');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to verify account status.' } });
  }

  return next();
};
