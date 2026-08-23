import { describe, expect, it, vi } from 'vitest';

import { recommendationsRepository } from '../modules/recommendations/recommendations.repository';
import { recommendationsService } from '../modules/recommendations/recommendations.service';

const skill = (id: string, categoryId: string) => ({ id, title: id, categoryId, category: null });

const user = {
  id: 'user_a', name: 'Alice', bio: null, location: null, avatarUrl: null, status: 'ACTIVE',
  skills: [skill('skill_teach', 'programming')],
  skillInterests: [{ skillId: 'skill_learn', interestType: 'LEARN' as const, skill: skill('skill_learn', 'design') }],
};

describe('discovery performance guard', () => {
  it('calculates a bounded 10k-candidate discovery result within two seconds', async () => {
    const candidates = Array.from({ length: 10_000 }, (_, index) => ({
      id: `user_${index}`,
      name: `User ${index}`,
      bio: null,
      location: null,
      avatarUrl: null,
      status: 'ACTIVE',
      skills: [skill(index === 0 ? 'skill_learn' : `other_skill_${index}`, index === 0 ? 'design' : 'other')],
      skillInterests: [{ skillId: index === 0 ? 'skill_teach' : `other_skill_${index}`, interestType: 'LEARN' as const, skill: skill(index === 0 ? 'skill_teach' : `other_skill_${index}`, 'programming') }],
    }));
    vi.spyOn(recommendationsRepository, 'findUserWithActiveSkillsAndInterests').mockResolvedValue(user as never);
    vi.spyOn(recommendationsRepository, 'findActiveUsersWithActiveSkillsAndInterests').mockResolvedValue(candidates.slice(0, 200) as never);

    const startedAt = performance.now();
    const result = await recommendationsService.getUserRecommendations('user_a');

    expect(performance.now() - startedAt).toBeLessThan(2_000);
    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe('user_0');
  });
});
