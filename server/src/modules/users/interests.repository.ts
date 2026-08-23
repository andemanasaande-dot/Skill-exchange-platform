import prisma from '../../infrastructure/database/prisma';

export const interestsRepository = {
  listTeachingByUserId: async (userId: string) => {
    return prisma.skill.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  listByUserId: async (userId: string) => {
    return prisma.userSkillInterest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        skillId: true,
        interestType: true,
        createdAt: true,
        skill: {
          select: {
            id: true,
            title: true,
            description: true,
            isActive: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  },

  findSkill: async (skillId: string) => {
    return prisma.skill.findUnique({
      where: { id: skillId },
      select: { id: true, title: true, description: true, isActive: true, category: { select: { id: true, name: true, slug: true } } },
    });
  },

  findByUserAndSkill: async (userId: string, skillId: string) => {
    return prisma.userSkillInterest.findUnique({
      where: { userId_skillId_interestType: { userId, skillId, interestType: 'LEARN' } },
      select: { id: true, skillId: true, interestType: true, createdAt: true },
    });
  },

  create: async (userId: string, skillId: string) => {
    return prisma.userSkillInterest.create({
      data: { userId, skillId, interestType: 'LEARN' },
      select: {
        id: true,
        skillId: true,
        interestType: true,
        createdAt: true,
        skill: {
          select: {
            id: true,
            title: true,
            description: true,
            isActive: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  },

  deleteByUserAndSkill: async (userId: string, skillId: string) => {
    return prisma.userSkillInterest.delete({
      where: { userId_skillId_interestType: { userId, skillId, interestType: 'LEARN' } },
    });
  },
};
