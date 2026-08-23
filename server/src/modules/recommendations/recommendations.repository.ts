import prisma from '../../infrastructure/database/prisma';

const skillSelect = {
  id: true,
  title: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

export const recommendationsRepository = {
  findUserWithActiveSkillsAndInterests: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        avatarUrl: true,
        status: true,
        skills: { where: { isActive: true }, select: skillSelect },
        skillInterests: {
          where: { interestType: 'LEARN', skill: { isActive: true } },
          select: {
            skillId: true,
            interestType: true,
            skill: { select: skillSelect },
          },
        },
      },
    });
  },

  findActiveUsersWithActiveSkillsAndInterests: async (userId: string, teachingSkillIds: string[], learningInterestIds: string[], limit = 200) => {
    return prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        skills: { some: { isActive: true, id: { in: learningInterestIds } } },
        skillInterests: { some: { interestType: 'LEARN', skillId: { in: teachingSkillIds }, skill: { isActive: true } } },
      },
      orderBy: { id: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        avatarUrl: true,
        status: true,
        skills: { where: { isActive: true }, select: skillSelect },
        skillInterests: {
          where: { interestType: 'LEARN', skill: { isActive: true } },
          select: {
            skillId: true,
            interestType: true,
            skill: { select: skillSelect },
          },
        },
      },
    });
  },
};
