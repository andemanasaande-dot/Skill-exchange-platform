import prisma from '../../infrastructure/database/prisma';

export const usersRepository = {
  block: (blockerId: string, blockedId: string) => prisma.userBlock.create({
    data: { blockerId, blockedId },
    select: { id: true, blockerId: true, blockedId: true, createdAt: true },
  }),

  unblock: (blockerId: string, blockedId: string) => prisma.userBlock.deleteMany({ where: { blockerId, blockedId } }),

  isBlocked: (blockerId: string, blockedId: string) => prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  }),

  findExists: (id: string) => prisma.user.findUnique({ where: { id }, select: { id: true } }),

  findById: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        location: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        receivedReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true } } },
        },
      },
    });
  },

  findPublicProfileById: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        receivedReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true } } },
        },
      },
    });
  },

  updateProfile: async (id: string, payload: {
    name?: string;
    bio?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
  }) => {
    return prisma.user.update({
      where: { id },
      data: payload,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        location: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        receivedReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true } } },
        },
      },
    });
  },
};
