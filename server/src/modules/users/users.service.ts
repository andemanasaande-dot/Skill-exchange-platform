import { usersRepository } from './users.repository';
import { eventBus } from '../../infrastructure/events/event-bus';
import { auditService } from '../../infrastructure/audit/audit.service';

const sanitizePublicUser = (user: {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  bio: user.bio,
  location: user.location,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const usersService = {
  getProfile: async (userId: string) => {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        location: user.location,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  },

  getPublicProfile: async (userId: string) => {
    const user = await usersRepository.findPublicProfileById(userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return {
      user: sanitizePublicUser(user),
    };
  },

  updateProfile: async (userId: string, payload: {
    name?: string;
    bio?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
  }) => {
    const existingUser = await usersRepository.findById(userId);

    if (!existingUser) {
      throw new Error('USER_NOT_FOUND');
    }

    const updatedUser = await usersRepository.updateProfile(userId, payload);
    await auditService.record({
      actorUserId: userId,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      payload: { changedFields: Object.keys(payload) },
    });
    await eventBus.publish('profile.updated', {
      userId,
      changedFields: Object.keys(payload),
    });

    return {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        bio: updatedUser.bio,
        location: updatedUser.location,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        status: updatedUser.status,
        emailVerified: updatedUser.emailVerified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    };
  },
};
