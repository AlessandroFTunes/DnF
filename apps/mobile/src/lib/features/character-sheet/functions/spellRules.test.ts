import { describe, expect, test } from 'bun:test';
import { spellState, type SpellStateInput } from './spellRules';

const levels: Record<string, number> = { c1: 0, c2: 0, c3: 0, c4: 0, a: 1, b: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1, k: 1, new1: 1, newc: 0 };
const base = (over: Partial<SpellStateInput>): SpellStateInput => ({
  model: 'list',
  counts: { cantrips: 4, spells: 9 },
  held: [],
  levelOf: (k) => levels[k],
  casterLevel: 5,
  prepareOpen: false,
  swapReady: false,
  ...over,
});
const sp = (key: string) => ({ key, level: levels[key] ?? 1 });
const held = (...keys: string[]) => keys.map((key) => ({ key, prepared: true }));

describe('Clérigo/Druida (lista inteira, troca no descanso longo) — 2024 nível 5: 4 truques e 9 preparadas', () => {
  const nineSpells = held('c1', 'c2', 'c3', 'c4', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j');
  test('completo e fora do descanso: tudo travado', () => {
    const st = spellState(base({ held: nineSpells }));
    expect(st.missingCantrips + st.missingSpells).toBe(0);
    expect(st.lockOf(sp('a'))).toBe('Só depois de um descanso longo');
    expect(st.lockOf(sp('k'))).toBe('Sem vaga de magia');
  });
  test('descanso longo abre a troca: remove e depois prepara outra', () => {
    const open = base({ held: nineSpells, prepareOpen: true });
    expect(spellState(open).lockOf(sp('a'))).toBeNull();
    const afterRemoval = spellState({ ...open, held: nineSpells.filter((s) => s.key !== 'a') });
    expect(afterRemoval.missingSpells).toBe(1);
    expect(afterRemoval.lockOf(sp('k'))).toBeNull();
  });
  test('subir de nível libera as vagas novas mesmo sem descanso', () => {
    const st = spellState(base({ held: held('c1', 'c2', 'c3', 'c4', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i') }));
    expect(st.missingSpells).toBe(1);
    expect(st.lockOf(sp('k'))).toBeNull();
    expect(st.lockOf(sp('a'))).toBe('Só depois de um descanso longo');
  });
});

describe('Mago (grimório 6 + 2 por nível, prepara do grimório)', () => {
  const book = (n: number, prepared: number) =>
    Array.from({ length: n }, (_, i) => ({ key: `s${i}`, prepared: i < prepared }));
  const wiz = (over: Partial<SpellStateInput> = {}) =>
    base({ model: 'book', counts: { cantrips: 4, spells: 9 }, levelOf: (k) => (k.startsWith('s') ? 1 : levels[k]), ...over });
  test('grimório do nível 5 cabe 14 magias', () => {
    expect(spellState(wiz()).bookCap).toBe(14);
    expect(spellState(wiz({ held: book(13, 9) })).lockOf({ key: 'x', level: 1 })).toBeNull();
    expect(spellState(wiz({ held: book(14, 9) })).lockOf({ key: 'x', level: 1 })).toBe('Grimório cheio');
  });
  test('copiar para o grimório não conta como preparada', () => {
    const st = spellState(wiz({ held: book(10, 9) }));
    expect(st.spellsCount).toBe(9);
    expect(st.missingSpells).toBe(0);
  });
  test('preparar outra do grimório só com o preparo aberto', () => {
    const closed = spellState(wiz({ held: book(10, 9) }));
    expect(closed.canTogglePrepared('s9')).toBe(false);
    const open = spellState(wiz({ held: book(10, 8), prepareOpen: true }));
    expect(open.canTogglePrepared('s9')).toBe(true);
    expect(spellState(wiz({ held: book(10, 9), prepareOpen: true })).canTogglePrepared('s9')).toBe(false);
  });
});

describe('Bardo/Bruxo/Feiticeiro/Guardião/Cavaleiro Místico (uma troca por nível de classe)', () => {
  const known = (over: Partial<SpellStateInput> = {}) => base({ model: 'known', counts: { cantrips: 3, spells: 2 }, ...over });
  test('escolhas iniciais livres até o limite', () => {
    const st = spellState(known({ held: held('c1', 'c2') }));
    expect(st.missingCantrips).toBe(1);
    expect(st.lockOf(sp('newc'))).toBeNull();
    expect(st.lockOf(sp('a'))).toBeNull();
  });
  test('com a troca usada, não remove nem troca', () => {
    const st = spellState(known({ held: held('c1', 'c2', 'c3', 'a', 'b'), swapReady: false }));
    expect(st.lockOf(sp('a'))).toBe('Troca já usada neste nível');
    expect(st.lockOf(sp('k'))).toBe('Sem vaga de magia');
  });
  test('ao subir de nível a troca volta', () => {
    const st = spellState(known({ held: held('c1', 'c2', 'c3', 'a', 'b'), swapReady: true }));
    expect(st.lockOf(sp('a'))).toBeNull();
  });
  test('sem tabela de magias (classe que não conjura) não há vagas', () => {
    const st = spellState(known({ counts: null }));
    expect(st.lockOf(sp('a'))).toBe('Sem vaga de magia');
    expect(st.lockOf(sp('newc'))).toBe('Sem vaga de truque');
  });
});
