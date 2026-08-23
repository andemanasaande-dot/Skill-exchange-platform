import prisma from '../../infrastructure/database/prisma';

export const usersRepository = {
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
      },
    });
  },
};
