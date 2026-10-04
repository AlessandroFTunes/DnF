import { z } from 'zod';
import { levelSchema } from './abilities';

/**
 * Seções da ficha. Aqui só fica o que o jogador escolheu e o estado da mesa;
 * regras e dados de D&D (dado de vida, magias, itens, habilidades…) vêm da Open5e pelas `*Key`.
 */
export namespace Sheet {
  const text = (max: number) => z.string().trim().max(max);
  const key = z.string().min(1).max(128).meta({ description: 'Open5e key (see DiferenteKey).' });
  const count = z.number().int().min(0);

  /** Multiclasse: o nível do personagem é a soma dos níveis de classe. */
  export const ClassLevel = z.object({
    classKey: key,
    subclassKey: key.nullable().default(null),
    level: levelSchema,
  });
  export type ClassLevel = z.infer<typeof ClassLevel>;

  /** Escolhas do jogador; o que a classe/espécie/antecedente já dá vem da API. */
  export const Proficiencies = z.object({
    skills: z.record(key, z.enum(['proficient', 'expertise'])).default({}),
    languages: z.array(key).default([]),
    tools: z.array(key).default([]),
    weaponMasteries: z.array(key).default([]),
  });

  export const Combat = z.object({
    hpMax: count.default(0),
    hpCurrent: count.default(0),
    hpTemp: count.default(0),
    hitDiceSpent: count.default(0),
    deathSaves: z
      .object({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) })
      .default({ successes: 0, failures: 0 }),
    exhaustion: count.default(0),
    conditionKeys: z.array(key).default([]),
  });

  export const Item = z.object({
    key,
    quantity: count.default(1),
    equipped: z.boolean().default(false),
    attuned: z.boolean().default(false),
  });

  export const Equipment = z.object({
    items: z.array(Item).default([]),
    coins: z
      .object({ cp: count, sp: count, ep: count, gp: count, pp: count })
      .default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
  });

  export const Spellcasting = z.object({
    spells: z.array(z.object({ key, prepared: z.boolean().default(false) })).default([]),
    /** Espaços gastos por nível de magia ("1"…"9"); o máximo vem da tabela da classe. */
    slotsUsed: z.partialRecord(z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9']), count).default({}),
    pactSlotsUsed: count.default(0),
  });

  export const Personality = z.object({
    traits: text(2000).default(''),
    ideals: text(2000).default(''),
    bonds: text(2000).default(''),
    flaws: text(2000).default(''),
  });

  export const Details = z.object({
    age: text(32).default(''),
    height: text(32).default(''),
    weight: text(32).default(''),
    eyes: text(32).default(''),
    skin: text(32).default(''),
    hair: text(32).default(''),
    appearance: text(4000).default(''),
    backstory: text(10000).default(''),
    allies: text(4000).default(''),
    notes: text(10000).default(''),
  });
}
