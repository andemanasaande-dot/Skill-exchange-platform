import { UserRole, UserStatus } from '@prisma/client';
import prisma from '../../infrastructure/database/prisma';
import { auditService } from '../../infrastructure/audit/audit.service';

export type SafeUserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const authRepository = {
  findById: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  findByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        avatarUrl: true,
        bio: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<SafeUserRecord | null>;
  },

  createUser: async (payload: {
    name: string;
    email: string;
    passwordHash: string;
  }) => {
    return prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash: payload.passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        avatarUrl: true,
        bio: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<SafeUserRecord>;
  },

  createRefreshToken: async (payload: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => {
    return prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
      },
    });
  },

  updateEmailVerificationStatus: async (userId: string, emailVerified: boolean) => {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  updatePasswordHash: async (userId: string, passwordHash: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  findRefreshTokenByHash: async (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });
  },

  createVerificationToken: async (payload: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => {
    return prisma.emailVerificationToken.create({
      data: {
        userId: payload.userId,
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
      },
    });
  },

  findVerificationTokenByHash: async (tokenHash: string) => {
    return prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            emailVerified: true,
          },
        },
      },
    });
  },

  findLatestVerificationTokenByUserId: async (userId: string) => {
    return prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createPasswordResetToken: async (payload: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => {
    return prisma.passwordResetToken.create({
      data: {
        userId: payload.userId,
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
      },
    });
  },

  findPasswordResetTokenByHash: async (tokenHash: string) => {
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        },
      },
    });
  },

  findLatestPasswordResetTokenByUserId: async (userId: string) => {
    return prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  markVerificationTokenUsed: async (tokenId: string): Promise<any> => {
    return prisma.emailVerificationToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },

  markPasswordResetTokenUsed: async (tokenId: string): Promise<any> => {
    return prisma.passwordResetToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },

  revokeRefreshToken: async (tokenId: string): Promise<any> => {
    return prisma.refreshToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  revokeAllActiveRefreshTokensForUser: async (userId: string) => {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count;
  },

  createAuditLog: async (payload: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown> | null;
  }) => {
    return auditService.record({
      actorUserId: payload.actorUserId,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      payload: payload.details,
    });
  },
};
