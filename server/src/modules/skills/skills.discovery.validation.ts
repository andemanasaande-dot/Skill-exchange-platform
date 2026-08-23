import { z } from 'zod';

const queryString = (message: string) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.string({ invalid_type_error: message }).trim().min(1, message),
  );

const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean({ invalid_type_error: 'Active must be true or false.' }));

const positiveIntegerQuery = (defaultValue: number, maximum?: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
    z.number({ invalid_type_error: 'Must be a positive integer.' }).int('Must be a whole number.').min(1, 'Must be at least 1.')
      .refine((value) => maximum === undefined || value <= maximum, `Must be no greater than ${maximum}.`),
  );

export const skillDiscoveryQuerySchema = z.object({
  search: queryString('Search must not be empty.').optional(),
  skill: queryString('Skill filter must not be empty.').optional(),
  category: queryString('Category must not be empty.').optional(),
  page: positiveIntegerQuery(1),
  limit: positiveIntegerQuery(20, 100),
  sort: z.enum(['newest', 'oldest', 'title_asc', 'title_desc', 'title'], {
    errorMap: () => ({ message: 'Sort must be newest, oldest, title_asc, title_desc, or title.' }),
  }).default('newest'),
  owner: queryString('Owner must not be empty.').optional(),
  active: booleanQuery.default(true),
}).strict();

export type SkillDiscoveryQuery = z.infer<typeof skillDiscoveryQuerySchema>;
