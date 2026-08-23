import { skillsRepository } from './skills.repository';
import type { SkillDiscoveryQuery } from './skills.discovery.validation';

export const skillsService = {
  listSkills: async (query: SkillDiscoveryQuery) => {
    const { skills, total } = await skillsRepository.list(query);

    return {
      data: skills,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },
  createSkill: async (payload: { userId: string; title: string; categoryId: string; description?: string; isActive?: boolean }) => {
    try {
      return await skillsRepository.create(payload);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new Error('DUPLICATE_SKILL');
      throw error;
    }
  },
  getSkill: (id: string) => skillsRepository.getById(id),
  updateSkill: async (userId: string, id: string, payload: { title?: string; categoryId?: string; description?: string; isActive?: boolean }) => {
    const skill = await skillsRepository.getById(id);
    if (!skill) throw new Error('SKILL_NOT_FOUND');
    if (skill.userId !== userId) throw new Error('FORBIDDEN');
    return skillsRepository.update(id, payload);
  },
  deleteSkill: async (userId: string, id: string) => {
    const skill = await skillsRepository.getById(id);
    if (!skill) throw new Error('SKILL_NOT_FOUND');
    if (skill.userId !== userId) throw new Error('FORBIDDEN');
    await skillsRepository.delete(id);
  },
};
