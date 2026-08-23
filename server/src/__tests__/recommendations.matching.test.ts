import { describe, expect, it } from 'vitest';
import { calculateMatch, calculateMatches, type MatchUser } from '../modules/recommendations/matching.algorithm';

const skill = (id: string, title: string, categoryId: string) => ({ id, title, categoryId });
const interest = (skillValue: ReturnType<typeof skill>) => ({ skillId: skillValue.id, interestType: 'LEARN' as const, skill: skillValue });

const currentUser: MatchUser = {
  id: 'user_a', name: 'Alice', status: 'ACTIVE',
  skills: [skill('skill_java', 'Java', 'programming')],
  skillInterests: [interest(skill('skill_photoshop', 'Photoshop', 'design'))],
};

const reciprocalCandidate: MatchUser = {
  id: 'user_b', name: 'Bob', status: 'ACTIVE',
  skills: [skill('skill_photoshop', 'Photoshop', 'design')],
  skillInterests: [interest(skill('skill_java', 'Java', 'programming'))],
};

describe('calculateMatch', () => {
  it('calculates a reciprocal match with a deterministic maximum score', () => {
    const result = calculateMatch(currentUser, reciprocalCandidate);

    expect(result?.score).toBe(80);
    expect(result?.matchedTeachingSkill.title).toBe('Java');
    expect(result?.matchedLearningInterest.skill.title).toBe('Java');
    expect(result?.reciprocalTeachingSkill.title).toBe('Photoshop');
    expect(result?.reciprocalLearningInterest.skill.title).toBe('Photoshop');
    expect(result?.explanation).toContain('You teach Java');
    expect(result?.explanation).toContain('they teach Photoshop');
  });

  it('rejects one-way, inactive, and self matches', () => {
    expect(calculateMatch(currentUser, { ...reciprocalCandidate, skillInterests: [] })).toBeNull();
    expect(calculateMatch(currentUser, { ...reciprocalCandidate, status: 'SUSPENDED' })).toBeNull();
    expect(calculateMatch(currentUser, { ...reciprocalCandidate, id: currentUser.id })).toBeNull();
  });

  it('sorts equal-score recommendations deterministically', () => {
    const secondCandidate = { ...reciprocalCandidate, id: 'user_c', name: 'Cara' };
    const results = calculateMatches(currentUser, [secondCandidate, reciprocalCandidate]);

    expect(results.map((result) => result.user.id)).toEqual(['user_b', 'user_c']);
  });
});
