import { describe, expect, test } from 'bun:test';
import { characterSpellSlots, subclassSpellCounts, type SrdClassDetail } from './index';

const sub = (extra: Partial<SrdClassDetail> = {}): SrdClassDetail =>
  ({ key: '1', name: 'Cavaleiro Místico', desc: '', source: { key: 's', name: 's' }, hit_dice: '', features: [], casting: { tipo: 'terco', atributo: 'Inteligência' }, ...extra }) as unknown as SrdClassDetail;

describe('subclassSpellCounts', () => {
  test('não conjura antes do nível 3 nem sem conjuração', () => {
    expect(subclassSpellCounts(sub(), 2, '2014')).toBeNull();
    expect(subclassSpellCounts(sub({ casting: null }), 5, '2014')).toBeNull();
  });
  test('tabela do conjurador de um terço', () => {
    expect(subclassSpellCounts(sub(), 3, '2014')).toEqual({ cantrips: 2, spells: 3, prepared: false });
    expect(subclassSpellCounts(sub(), 7, '2014')).toEqual({ cantrips: 2, spells: 5, prepared: false });
    expect(subclassSpellCounts(sub(), 10, '2024')).toEqual({ cantrips: 3, spells: 7, prepared: true });
    expect(subclassSpellCounts(sub(), 20, '2014')?.spells).toBe(13);
  });
  test('prefere a tabela da subclasse quando a API traz', () => {
    const tables = [{ title: 'Cavaleiro Místico', columns: ['Nível', 'Truques', 'Magias preparadas'], rows: [['3', '2', '4'], ['8', '2', '7']] }];
    expect(subclassSpellCounts(sub({ tables }), 9, '2014')).toEqual({ cantrips: 2, spells: 7, prepared: true });
  });
  test('lê a tabela real "Conjuração de Cavaleiro Místico" da API (sem coluna de truques)', () => {
    const tables = [
      {
        title: 'Conjuração de Cavaleiro Místico',
        columns: ['Nível de Guerreiro', 'Magias Preparadas', '1', '2', '3', '4'],
        rows: [['3', '3', '2', '—', '—', '—'], ['4', '4', '3', '—', '—', '—'], ['7', '5', '4', '2', '—', '—'], ['10', '7', '4', '3', '—', '—'], ['20', '13', '4', '3', '3', '1']],
      },
    ];
    expect(subclassSpellCounts(sub({ tables }), 3, '2024')).toEqual({ cantrips: 2, spells: 3, prepared: true });
    expect(subclassSpellCounts(sub({ tables }), 9, '2024')).toEqual({ cantrips: 2, spells: 5, prepared: true });
    expect(subclassSpellCounts(sub({ tables }), 10, '2024')).toEqual({ cantrips: 3, spells: 7, prepared: true });
    expect(subclassSpellCounts(sub({ tables }), 20, '2024')?.spells).toBe(13);
  });
});

describe('characterSpellSlots com subclasse conjuradora', () => {
  test('usa a tabela de multiclasse pelo nível de conjurador', () => {
    const cls = { key: 'f', name: 'Guerreiro', features: [], casting: null, api: { progressao: [{ nivel: 3, espacos_magia: [] }] } } as unknown as SrdClassDetail;
    const table = [{ casterLevel: 1, slots: [2] }, { casterLevel: 2, slots: [3] }] as never;
    expect(characterSpellSlots([{ cls, subclass: sub(), level: 6 }], table).slots).toEqual({ '1': 3 });
  });
});

import { grantedSpellNames, spellModel, subclassSchools, createSrdCatalog } from './index';

const named = (name: string) => ({ name }) as unknown as SrdClassDetail;

describe('spellModel (nomes e livros reais)', () => {
  test.each([
    ['Mago', 'book'],
    ['Clérigo', 'list'],
    ['Druida', 'list'],
    ['Paladino', 'list'],
    ['Artífice', 'list'],
    // 2024: têm "Magias Preparadas" na tabela, mas só trocam uma ao subir de nível
    ['Bardo', 'known'],
    ['Bruxo', 'known'],
    ['Feiticeiro', 'known'],
    ['Guardião', 'known'],
  ])('%s → %s', (name, model) => {
    expect(spellModel(named(name))).toBe(model as never);
  });
  test('subclasse conjuradora troca ao subir de nível', () => {
    expect(spellModel(named('Guerreiro'), true)).toBe('known');
  });
});

describe('magias sempre preparadas', () => {
  const sub = { alwaysPrepared: [{ level: 3, spells: ['º Toque Necrótico', 'Repouso Tranquilo'] }, { level: 5, spells: ['Bola de Fogo'] }] } as unknown as SrdClassDetail;
  test('até o nível da classe, sem prefixo solto', () => {
    expect(grantedSpellNames(sub, 3)).toEqual(['Toque Necrótico', 'Repouso Tranquilo']);
    expect(grantedSpellNames(sub, 5)).toContain('Bola de Fogo');
    expect(grantedSpellNames(null, 5)).toEqual([]);
  });
});

describe('restrição de escolas', () => {
  test('lê as escolas do texto de 2014', () => {
    const sub = { features: [{ name: 'Conjuração', desc: 'As magias devem ser escolhidas das escolas de abjuração e evocação. Você aprende...' }] } as unknown as SrdClassDetail;
    expect(subclassSchools(sub)).toEqual(['abjuracao', 'evocacao']);
  });
  test('sem restrição no texto de 2024', () => {
    const sub = { features: [{ name: 'Conjuração', desc: 'Escolha três magias de 1º círculo da lista de magias de Mago.' }] } as unknown as SrdClassDetail;
    expect(subclassSchools(sub)).toEqual([]);
  });
});

test('spellsByName busca pelo nome e prefere a edição pedida', async () => {
  const magia = (id: number, edicao: string) => ({ id, nome: 'Sono', circulo: 1, escola: 'Encantamento', descricao: '', tempo_conjuracao: '1 ação', alcance: '9 m', duracao: 'Instantânea', componentes: 'V, S', classes: [], fonte: { id, nome: 'x', edicao } });
  const queries: unknown[] = [];
  const client = {
    GET: async (_: string, opts: { params: { query: unknown } }) => {
      queries.push(opts.params.query);
      return { data: [magia(1, '5e'), magia(2, '5.5e')], response: new Response(null, { status: 200 }) };
    },
  } as unknown as Parameters<typeof createSrdCatalog>[0];
  const found = await createSrdCatalog(client).spellsByName(['Sono'], '2024');
  expect((queries[0] as { nome: string }).nome).toBe('Sono');
  expect(found.map((s) => s.key)).toEqual(['2']);
});

describe('espaços da subclasse conjuradora (tabela real do Cavaleiro Místico)', () => {
  const tables = [
    {
      title: 'Conjuração de Cavaleiro Místico',
      columns: ['Nível de Guerreiro', 'Magias Preparadas', '1', '2', '3', '4'],
      rows: [['3', '3', '2', '—', '—', '—'], ['4', '4', '3', '—', '—', '—'], ['7', '5', '4', '2', '—', '—'], ['19', '12', '4', '3', '3', '1'], ['20', '13', '4', '3', '3', '1']],
    },
  ];
  const cls = { key: 'f', name: 'Guerreiro', features: [], casting: null, api: { progressao: [{ nivel: 3, espacos_magia: [] }] } } as unknown as SrdClassDetail;
  const at = (level: number) => characterSpellSlots([{ cls, subclass: sub({ tables }), level }], []).slots;
  test('usa a tabela da subclasse, não o terço do nível', () => {
    expect(at(3)).toEqual({ '1': 2 });
    expect(at(4)).toEqual({ '1': 3 });
    expect(at(7)).toEqual({ '1': 4, '2': 2 });
    expect(at(20)).toEqual({ '1': 4, '2': 3, '3': 3, '4': 1 });
  });
});
