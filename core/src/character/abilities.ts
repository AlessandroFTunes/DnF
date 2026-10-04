import { z } from 'zod';

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const abilitySchema = z.enum(ABILITIES);
export type Ability = z.infer<typeof abilitySchema>;

export const abilityScoreSchema = z.number().int().min(1).max(30);
export const abilityScoresSchema = z.object({
  str: abilityScoreSchema,
  dex: abilityScoreSchema,
  con: abilityScoreSchema,
  int: abilityScoreSchema,
  wis: abilityScoreSchema,
  cha: abilityScoreSchema,
});
export type AbilityScores = z.infer<typeof abilityScoresSchema>;

export const levelSchema = z.number().int().min(1).max(20);

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
