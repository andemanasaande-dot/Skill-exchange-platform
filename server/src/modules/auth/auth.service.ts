import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { defaultEmailService } from '../../infrastructure/email/email.service';
import { authRepository } from './auth.repository';

export type AuthUserLike = {
  id: string;
  email: string;
  role?: string;
  status?: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
  status?: string;
  type: 'access';
  iat?: number;
  exp?: number;
};

export type RefreshTokenPayload = {
  sub: string;
  email: string;
  role: string;
  status?: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
};

const ACCESS_TOKEN_SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, ACCESS_TOKEN_SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateAccessToken = (user: AuthUserLike): string => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role ?? 'USER',
      status: user.status ?? 'ACTIVE',
      type: 'access',
    },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'] },
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;

  if (payload.type !== 'access') {
    throw new Error('Invalid access token type');
  }

  return payload;
};

export const generateRefreshToken = (user: AuthUserLike): string => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role ?? 'USER',
      status: user.status ?? 'ACTIVE',
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'] },
  );
};

export const hashRefreshToken = async (token: string): Promise<string> => {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
};

export const verifyRefreshTokenHash = async (token: string, hash: string): Promise<boolean> => {
  const expected = await hashRefreshToken(token);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }

  return payload;
};

export const generateEmailVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const registerUser = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await authRepository.findByEmail(normalizedEmail);

  if (existingUser) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const emailVerificationToken = generateEmailVerificationToken();

  const createdUser = await authRepository.createUser({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  void emailVerificationToken;

  return {
    id: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
    status: createdUser.status,
    emailVerified: createdUser.emailVerified,
    avatarUrl: createdUser.avatarUrl,
    bio: createdUser.bio,
  };
};

export const loginUser = async ({ email, password }: { email: string; password: string }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await authRepository.findByEmail(normalizedEmail);

  if (!user) {
    await authRepository.createAuditLog({
      actorUserId: null,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: normalizedEmail,
      details: {
        email: normalizedEmail,
        reason: 'INVALID_CREDENTIALS',
      },
    });

    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash ?? '');

  if (!passwordMatches) {
    await authRepository.createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: user.id,
      details: {
        email: user.email,
        reason: 'INVALID_CREDENTIALS',
      },
    });

    throw new Error('INVALID_CREDENTIALS');
  }

  if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'DEACTIVATED') {
    await authRepository.createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      entityId: user.id,
      details: {
        email: user.email,
        reason: 'ACCOUNT_DISABLED',
        status: user.status,
      },
    });

    throw new Error('ACCOUNT_DISABLED');
  }

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt,
  });

  await authRepository.createAuditLog({
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'AUTH',
    entityId: user.id,
    details: {
      email: user.email,
      status: user.status,
      role: user.role,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
  };
};

const mapRefreshTokenVerificationError = (error: unknown): Error => {
  if (error instanceof Error && error.name === 'TokenExpiredError') {
    return new Error('REFRESH_TOKEN_EXPIRED');
  }

  return new Error('INVALID_REFRESH_TOKEN');
};

export const refreshUserSession = async ({ refreshToken }: { refreshToken: string }) => {
  let payload: RefreshTokenPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw mapRefreshTokenVerificationError(error);
  }

  const tokenHash = await hashRefreshToken(refreshToken);
  const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    throw new Error('REFRESH_TOKEN_REUSED');
  }

  if (storedToken.revokedAt) {
    throw new Error('REFRESH_TOKEN_REVOKED');
  }

  if (storedToken.expiresAt <= new Date()) {
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  const revoked = await authRepository.revokeRefreshToken(storedToken.id);
  if (typeof revoked === 'object' && 'count' in revoked && revoked.count === 0) {
    throw new Error('REFRESH_TOKEN_REUSED');
  }

  const userRecord = await authRepository.findByEmail(storedToken.user.email);

  if (!userRecord) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (userRecord.status === 'SUSPENDED' || userRecord.status === 'BANNED' || userRecord.status === 'DEACTIVATED') {
    throw new Error('ACCOUNT_DISABLED');
  }

  const accessToken = generateAccessToken({
    id: userRecord.id,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
  });

  const newRefreshToken = generateRefreshToken({
    id: userRecord.id,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
  });

  const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
  const nextExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await authRepository.createRefreshToken({
    userId: userRecord.id,
    tokenHash: newRefreshTokenHash,
    expiresAt: nextExpiresAt,
  });

  await authRepository.createAuditLog({
    actorUserId: userRecord.id,
    action: 'REFRESH_SUCCESS',
    entityType: 'AUTH',
    entityId: userRecord.id,
    details: {
      email: userRecord.email,
      rotated: true,
    },
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      status: userRecord.status,
      emailVerified: userRecord.emailVerified,
      avatarUrl: userRecord.avatarUrl,
      bio: userRecord.bio,
    },
  };
};

export const logoutUser = async ({ refreshToken }: { refreshToken: string }) => {
  let payload: RefreshTokenPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw mapRefreshTokenVerificationError(error);
  }

  const tokenHash = await hashRefreshToken(refreshToken);
  const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    throw new Error('REFRESH_TOKEN_REUSED');
  }

  if (storedToken.revokedAt) {
    throw new Error('REFRESH_TOKEN_REVOKED');
  }

  await authRepository.revokeRefreshToken(storedToken.id);

  await authRepository.createAuditLog({
    actorUserId: payload.sub,
    action: 'LOGOUT_SUCCESS',
    entityType: 'AUTH',
    entityId: payload.sub,
    details: {
      email: payload.email,
      revokedCurrentToken: true,
    },
  });

  return {
    revoked: true,
    userId: payload.sub,
  };
};

export const logoutAllUserSessions = async (userId: string) => {
  const revokedCount = await authRepository.revokeAllActiveRefreshTokensForUser(userId);

  await authRepository.createAuditLog({
    actorUserId: userId,
    action: 'LOGOUT_ALL_SUCCESS',
    entityType: 'AUTH',
    entityId: userId,
    details: {
      revokedCount,
    },
  });

  return {
    revokedCount,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const requestEmailVerification = async ({ email }: { email: string }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await authRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.emailVerified) {
    throw new Error('EMAIL_ALREADY_VERIFIED');
  }

  const latestToken = await authRepository.findLatestVerificationTokenByUserId(user.id);
  if (latestToken && latestToken.createdAt > new Date(Date.now() - 60_000)) {
    throw new Error('VERIFICATION_RESEND_RATE_LIMITED');
  }

  const token = generateEmailVerificationToken();
  const tokenHash = await hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await authRepository.createVerificationToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await defaultEmailService.sendVerificationEmail({
    to: user.email,
    name: user.name,
    token,
  });

  await authRepository.createAuditLog({
    actorUserId: user.id,
    action: 'EMAIL_VERIFICATION_SENT',
    entityType: 'EMAIL_VERIFICATION',
    entityId: user.id,
    details: {
      email: user.email,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    sent: true,
    email: user.email,
  };
};

export const verifyEmailAddress = async ({ token }: { token: string }) => {
  const hashedToken = await hashRefreshToken(token);
  const verificationToken = await authRepository.findVerificationTokenByHash(hashedToken);

  if (!verificationToken) {
    throw new Error('INVALID_VERIFICATION_TOKEN');
  }

  if (verificationToken.usedAt) {
    throw new Error('VERIFICATION_TOKEN_USED');
  }

  if (verificationToken.expiresAt <= new Date()) {
    throw new Error('VERIFICATION_TOKEN_EXPIRED');
  }

  const user = verificationToken.user;
  if (!user) {
    throw new Error('INVALID_VERIFICATION_TOKEN');
  }

  if (user.emailVerified) {
    throw new Error('EMAIL_ALREADY_VERIFIED');
  }

  const verificationClaim = await authRepository.markVerificationTokenUsed(verificationToken.id);
  if (typeof verificationClaim === 'object' && 'count' in verificationClaim && verificationClaim.count === 0) {
    throw new Error('VERIFICATION_TOKEN_USED');
  }
  await authRepository.updateEmailVerificationStatus(user.id, true);

  await authRepository.createAuditLog({
    actorUserId: user.id,
    action: 'EMAIL_VERIFIED',
    entityType: 'EMAIL_VERIFICATION',
    entityId: user.id,
    details: {
      email: user.email,
      verifiedAt: new Date().toISOString(),
    },
  });

  return {
    verified: true,
    email: user.email,
  };
};

export const requestPasswordReset = async ({ email }: { email: string }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await authRepository.findByEmail(normalizedEmail);

  if (!user) {
    try {
      await authRepository.createAuditLog({
        actorUserId: null,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'AUTH',
        entityId: normalizedEmail,
        details: {
          email: normalizedEmail,
          reason: 'ACCOUNT_NOT_FOUND',
        },
      });
    } catch {
      // swallow audit failures so the request remains non-revealing and does not leak account existence.
    }

    return {
      sent: true,
      email: normalizedEmail,
      message: 'If an account exists for this email, a password reset link has been sent.',
    };
  }

  const latestToken = await authRepository.findLatestPasswordResetTokenByUserId(user.id);
  if (latestToken && latestToken.createdAt > new Date(Date.now() - 60_000)) {
    try {
      await authRepository.createAuditLog({
        actorUserId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'AUTH',
        entityId: user.id,
        details: {
          email: user.email,
          reason: 'RATE_LIMITED',
        },
      });
    } catch {
      // continue with the generic response so the user cannot infer account existence from a failure.
    }

    return {
      sent: true,
      email: user.email,
      message: 'If an account exists for this email, a password reset link has been sent.',
    };
  }

  const token = generateEmailVerificationToken();
  const tokenHash = await hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await authRepository.createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await defaultEmailService.sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    token,
  });

  await authRepository.createAuditLog({
    actorUserId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'AUTH',
    entityId: user.id,
    details: {
      email: user.email,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    sent: true,
    email: user.email,
    message: 'If an account exists for this email, a password reset link has been sent.',
  };
};

export const resetPassword = async ({ token, password }: { token: string; password: string }) => {
  const hashedToken = await hashRefreshToken(token);
  const passwordResetToken = await authRepository.findPasswordResetTokenByHash(hashedToken);

  if (!passwordResetToken) {
    throw new Error('INVALID_RESET_TOKEN');
  }

  if (passwordResetToken.usedAt) {
    throw new Error('RESET_TOKEN_USED');
  }

  if (passwordResetToken.expiresAt <= new Date()) {
    throw new Error('RESET_TOKEN_EXPIRED');
  }

  const user = passwordResetToken.user;
  if (!user) {
    throw new Error('INVALID_RESET_TOKEN');
  }

  const passwordHash = await hashPassword(password);

  const resetClaim = await authRepository.markPasswordResetTokenUsed(passwordResetToken.id);
  if (typeof resetClaim === 'object' && 'count' in resetClaim && resetClaim.count === 0) {
    throw new Error('RESET_TOKEN_USED');
  }
  await authRepository.updatePasswordHash(user.id, passwordHash);
  await authRepository.revokeAllActiveRefreshTokensForUser(user.id);

  await authRepository.createAuditLog({
    actorUserId: user.id,
    action: 'PASSWORD_RESET_SUCCESS',
    entityType: 'AUTH',
    entityId: user.id,
    details: {
      email: user.email,
      resetAt: new Date().toISOString(),
      revokedSessions: true,
    },
  });

  return {
    reset: true,
    email: user.email,
  };
};

export const authService = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
  verifyRefreshToken,
  generateEmailVerificationToken,
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
  logoutAllUserSessions,
  getCurrentUser,
  requestEmailVerification,
  verifyEmailAddress,
  requestPasswordReset,
  resetPassword,
};
