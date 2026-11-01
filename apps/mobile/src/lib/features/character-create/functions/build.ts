import type { Character } from '@dnf/core/character';
import { featHitPointsPerLevel, hitPointMax } from '@dnf/sdk/srd';
import type { Inventory } from './inventory';
import type { Creation } from './useCreation';

export type CharacterInput = Parameters<typeof Character.create>[0];

/** PV máximos no 1º nível: dado de vida cheio + CON (+ Robustez Anã, + talento Robusto). */
export function startingHitPoints(c: Creation): number | null {
  if (!c.klass || !c.scores) return null;
  const feats = [c.backgroundFeat, c.originFeat].filter((f) => f !== null);
  return hitPointMax(c.klass.hitDie, 1, c.scores.con, (c.species?.hpPerLevel ?? 0) + featHitPointsPerLevel(feats));
}

/**
 * Converte o rascunho no personagem salvo. Só entram as escolhas do jogador e o estado inicial
 * (PV, itens, moedas); o que a classe/espécie/antecedente já dá é lido da 5e-FastAPI na ficha.
 */
export function buildCharacter(c: Creation, inventory: Inventory): CharacterInput | null {
  const { draft, scores } = c;
  const hp = startingHitPoints(c);
  if (!draft.edition || !draft.classKey || !draft.speciesKey || !scores || hp === null) return null;

  // Perícias escolhidas; a especialização pode cair também numa perícia dada pelo antecedente.
  const chosen = [...draft.classSkills, ...draft.speciesSkills, ...draft.backgroundSkills];
  const skills: Record<string, 'proficient' | 'expertise' | 'none'> = {};
  for (const key of chosen) skills[key] = 'proficient';
  for (const key of draft.expertise) skills[key] = 'expertise';
  // Perícias da raça trocadas pela Origem Personalizada: a ficha não deve somá-las de novo.
  for (const key of c.swappedSpeciesSkills) if (!skills[key]) skills[key] = 'none';

  const spells = [...draft.cantrips, ...draft.spells, ...draft.featCantrips, ...(draft.featSpell ? [draft.featSpell] : [])];

  return {
    name: draft.name.trim(),
    edition: draft.edition,
    classes: [{ classKey: draft.classKey, subclassKey: draft.subclassKey, level: 1 }],
    speciesKey: draft.speciesKey,
    backgroundKey: draft.backgroundKey,
    alignmentKey: draft.alignmentKey,
    featKeys: [c.backgroundFeat?.key, c.originFeat?.key].filter((k): k is string => !!k),
    abilities: scores,
    proficiencies: { skills, languages: draft.languages },
    combat: { hpMax: hp, hpCurrent: hp },
    equipment: {
      items: inventory.items.map((i) => ({ key: i.key, quantity: i.quantity, equipped: i.equipped })),
      custom: inventory.custom,
      coins: { cp: 0, sp: 0, ep: 0, gp: inventory.gp, pp: 0 },
    },
    spellcasting: { spells: [...new Set(spells)].map((key) => ({ key, prepared: true })) },
    personality: draft.personality,
    details: { ...draft.details, allies: '', notes: '' },
  };
}
