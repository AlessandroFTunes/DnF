import { z } from 'zod';
import { abilityScoresSchema, levelSchema } from './abilities';

export const characterSchema = z.object({
  name: z.string().trim().min(1).max(64),
  level: levelSchema,
  abilities: abilityScoresSchema,
});
export type Character = z.infer<typeof characterSchema>;
