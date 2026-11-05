import type { SpellModel } from '@dnf/sdk/srd';

export interface HeldSpell {
  key: string;
  prepared: boolean;
}

export interface SpellStateInput {
  model: SpellModel;
  /** Limites da classe no nível (null: a classe não tem tabela de magias). */
  counts: { cantrips: number; spells: number } | null;
  /** Magias que esta classe deu ao personagem (sem as concedidas por talento ou subclasse). */
  held: HeldSpell[];
  levelOf: (key: string) => number | undefined;
  casterLevel: number;
  /** Janela de preparo aberta (descanso longo). */
  prepareOpen: boolean;
  /** Ainda não trocou uma magia neste nível de classe. */
  swapReady: boolean;
}

/** Contagens, vagas e travas das magias de uma classe. Sem tela: as regras ficam aqui para serem testadas. */
export function spellState(input: SpellStateInput) {
  const { model, counts, held, levelOf, casterLevel, prepareOpen, swapReady } = input;
  const cantripsHeld = held.filter((s) => levelOf(s.key) === 0).length;
  const leveledHeld = held.filter((s) => (levelOf(s.key) ?? 1) > 0);
  const spellsCount = model === 'known' ? leveledHeld.length : leveledHeld.filter((s) => s.prepared).length;
  const cantripCap = counts?.cantrips ?? 0;
  const spellCap = counts?.spells ?? 0;
  // Grimório do Mago: 6 magias no 1º nível e mais 2 a cada nível.
  const bookCap = 6 + 2 * (casterLevel - 1);
  const missingCantrips = Math.max(0, cantripCap - cantripsHeld);
  const missingSpells = Math.max(0, spellCap - spellsCount);
  const has = (key: string) => held.some((s) => s.key === key);
  const isPrepared = (key: string) => held.find((s) => s.key === key)?.prepared ?? false;

  /** Por que a ação sobre esta magia está bloqueada (null = liberada). Adicionar, remover ou trocar. */
  function lockOf(spell: { key: string; level: number }): string | null {
    if (has(spell.key)) {
      if (model === 'book' && spell.level > 0) return null;
      if (model === 'known') return swapReady ? null : 'Troca já usada neste nível';
      return prepareOpen ? null : 'Só depois de um descanso longo';
    }
    if (spell.level === 0) return missingCantrips > 0 ? null : 'Sem vaga de truque';
    if (model === 'book') return leveledHeld.length < bookCap ? null : 'Grimório cheio';
    if (spellsCount >= spellCap) return 'Sem vaga de magia';
    return model === 'known' || prepareOpen || missingSpells > 0 ? null : 'Só depois de um descanso longo';
  }

  /** Marcar ou desmarcar "preparada" no grimório do Mago. */
  function canTogglePrepared(key: string): boolean {
    if (isPrepared(key)) return prepareOpen;
    return (prepareOpen || missingSpells > 0) && spellsCount < spellCap;
  }

  return { cantripsHeld, leveledHeld, spellsCount, cantripCap, spellCap, bookCap, missingCantrips, missingSpells, lockOf, canTogglePrepared };
}
