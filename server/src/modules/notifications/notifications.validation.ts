import { z } from 'zod';

const positiveInteger = (defaultValue: number, maximum?: number) => z.preprocess(
  (value) => value === undefined ? defaultValue : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).refine((value) => maximum === undefined || value <= maximum, `Must be no greater than ${maximum}.`),
);

export const notificationQuerySchema = z.object({
  page: positiveInteger(1),
  limit: positiveInteger(20, 100),
}).strict();

export const notificationIdSchema = z.object({ id: z.string().trim().min(1) });
