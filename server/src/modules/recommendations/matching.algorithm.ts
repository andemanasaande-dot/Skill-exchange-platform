export type MatchSkill = {
  id: string;
  title: string;
  categoryId: string;
  category?: { id: string; name: string; slug: string } | null;
};

export type MatchInterest = {
  skillId: string;
  interestType: 'LEARN';
  skill: MatchSkill;
};

export type MatchUser = {
  id: string;
  name: string;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  status: 'ACTIVE' | string;
  skills: MatchSkill[];
  skillInterests: MatchInterest[];
};

export type UserMatch = {
  user: Pick<MatchUser, 'id' | 'name' | 'bio' | 'location' | 'avatarUrl'>;
  matchedTeachingSkill: MatchSkill;
  matchedLearningInterest: MatchInterest;
  reciprocalTeachingSkill: MatchSkill;
  reciprocalLearningInterest: MatchInterest;
  score: number;
  explanation: string;
};

type DirectionalMatch = {
  teachingSkill: MatchSkill;
  learningInterest: MatchInterest;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('en-US');

const findDirectionalMatches = (teachingSkills: MatchSkill[], learningInterests: MatchInterest[]) =>
  teachingSkills
    .flatMap((teachingSkill) => learningInterests
      .filter((interest) => interest.skillId === teachingSkill.id)
      .map((learningInterest) => ({ teachingSkill, learningInterest })))
    .sort((left, right) => left.teachingSkill.id.localeCompare(right.teachingSkill.id) || left.learningInterest.skillId.localeCompare(right.learningInterest.skillId));

const chooseBestMatch = (matches: DirectionalMatch[]) => matches[0];

export const calculateMatch = (currentUser: MatchUser, candidate: MatchUser): UserMatch | null => {
  if (currentUser.id === candidate.id || candidate.status !== 'ACTIVE') return null;

  const currentTeaches = currentUser.skills.filter((skill) => skill.id);
  const candidateTeaches = candidate.skills.filter((skill) => skill.id);
  const currentWantsToLearn = currentUser.skillInterests.filter((interest) => interest.interestType === 'LEARN');
  const candidateWantsToLearn = candidate.skillInterests.filter((interest) => interest.interestType === 'LEARN');
  const currentToCandidate = findDirectionalMatches(currentTeaches, candidateWantsToLearn);
  const candidateToCurrent = findDirectionalMatches(candidateTeaches, currentWantsToLearn);

  if (currentToCandidate.length === 0 || candidateToCurrent.length === 0) return null;

  const firstDirection = chooseBestMatch(currentToCandidate);
  const reciprocalDirection = chooseBestMatch(candidateToCurrent);
  const categoryCompatible = firstDirection.teachingSkill.categoryId === reciprocalDirection.teachingSkill.categoryId;
  const score = Math.min(100, 70 + (categoryCompatible ? 20 : 0) + 5 + 5);
  const currentTeaching = firstDirection.teachingSkill;
  const candidateLearning = firstDirection.learningInterest;

  const explanation = `You teach ${currentTeaching.title}, which this user wants to learn, and they teach ${reciprocalDirection.teachingSkill.title}, which you want to learn.`;

  return {
    user: {
      id: candidate.id,
      name: candidate.name,
      bio: candidate.bio,
      location: candidate.location,
      avatarUrl: candidate.avatarUrl,
    },
    matchedTeachingSkill: currentTeaching,
    matchedLearningInterest: candidateLearning,
    reciprocalTeachingSkill: reciprocalDirection.teachingSkill,
    reciprocalLearningInterest: reciprocalDirection.learningInterest,
    score,
    explanation,
  };
};

export const calculateMatches = (currentUser: MatchUser, candidates: MatchUser[]) =>
  candidates
    .map((candidate) => calculateMatch(currentUser, candidate))
    .filter((match): match is UserMatch => match !== null)
    .sort((left, right) => right.score - left.score || normalize(left.user.name).localeCompare(normalize(right.user.name)) || left.user.id.localeCompare(right.user.id));
