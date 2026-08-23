import { z } from 'zod';

export const createInterestSchema = z
  .object({
    skillId: z
      .string({ required_error: 'Skill ID is required', invalid_type_error: 'Skill ID must be a string' })
      .trim()
      .min(1, 'Skill ID is required'),
  })
  .strict();

export const interestSkillIdSchema = z.object({
  skillId: z
    .string({ required_error: 'Skill ID is required', invalid_type_error: 'Skill ID must be a string' })
    .trim()
    .min(1, 'Skill ID is required'),
});
