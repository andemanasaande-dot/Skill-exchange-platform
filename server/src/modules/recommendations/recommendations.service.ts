import { calculateMatches } from './matching.algorithm';
import { recommendationsRepository } from './recommendations.repository';

export const recommendationsService = {
  getUserRecommendations: async (userId: string) => {
    const currentUser = await recommendationsRepository.findUserWithActiveSkillsAndInterests(userId);

    if (!currentUser) throw new Error('USER_NOT_FOUND');

    const candidates = await recommendationsRepository.findActiveUsersWithActiveSkillsAndInterests(
      userId,
      currentUser.skills.map((skill) => skill.id),
      currentUser.skillInterests.map((interest) => interest.skillId),
    );

    return calculateMatches(currentUser, candidates);
  },
};
