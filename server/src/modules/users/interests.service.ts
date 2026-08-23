import { interestsRepository } from './interests.repository';

export const interestsService = {
  list: async (userId: string) => ({
    skillsToTeach: await interestsRepository.listTeachingByUserId(userId),
    skillsToLearn: await interestsRepository.listByUserId(userId),
  }),

  add: async (userId: string, skillId: string) => {
    const skill = await interestsRepository.findSkill(skillId);

    if (!skill) throw new Error('SKILL_NOT_FOUND');
    if (!skill.isActive) throw new Error('SKILL_INACTIVE');

    const existingInterest = await interestsRepository.findByUserAndSkill(userId, skillId);
    if (existingInterest) throw new Error('INTEREST_ALREADY_EXISTS');

    try {
      return await interestsRepository.create(userId, skillId);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new Error('INTEREST_ALREADY_EXISTS');
      }
      throw error;
    }
  },

  remove: async (userId: string, skillId: string) => {
    try {
      await interestsRepository.deleteByUserAndSkill(userId, skillId);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new Error('INTEREST_NOT_FOUND');
      }
      throw error;
    }
  },
};
