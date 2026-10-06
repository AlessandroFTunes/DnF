import type { components } from './5e-fastapi';
import type { SrdClient } from './index';
import { ALIGNMENTS, LANGUAGES, SRD_EDITIONS, type SrdAlignment, type SrdEdition, type SrdLanguage } from './reference';

type Schemas = components['schemas'];

/**
 * Formatos que o app usa, montados a partir da 5e-FastAPI. Cada registro ganha uma `key` (texto, é o que
 * fica guardado no personagem) e um `name`; o registro original da API fica em `api` quando as regras
 * precisam dos campos estruturados.
 */

export interface SrdSource {
  key: string;
  name: string;
  edition: SrdEdition | null;
}

/** Característica de classe/subclasse com o nível em que é ganha. */
export interface SrdClassFeature {
  key: string;
  name: string;
  desc: string;
  gained_at: { level: number; detail: string | null }[];
}

export interface SrdClassDetail {
  key: string;
  name: string;
  desc: string;
  source: SrdSource;
  /** "d12", como a ficha mostra. */
  hit_dice: string;
  features: SrdClassFeature[];
  /** Registro da classe na API (ausente nas subclasses). */
  api?: Schemas['Classe'];
  /** Subclasse feita para a outra edição (a API ainda não mistura edições; fica para o futuro). */
  adaptedFrom?: SrdEdition;
}

export type SrdClass = SrdClassDetail;

export interface SrdSpeciesTrait {
  name: string;
  desc: string;
  type?: 'SIZE' | 'SPEED';
  order: number;
}

export interface SrdSpecies {
  key: string;
  name: string;
  desc: string;
  source: SrdSource;
  is_subspecies: boolean;
  subspecies_of: string | null;
  traits: SrdSpeciesTrait[];
}

/** Espécie base com as subespécies dela (a API de 2024 não tem subespécies). */
export interface SrdSpeciesGroup extends SrdSpecies {
  subspecies: SrdSpecies[];
}

export interface SrdBackground {
  key: string;
  name: string;
  desc: string;
  /** Livro de origem (para agrupar a lista). */
  document: { key: string; name: string };
  /** Benefícios em texto, para exibir (`type`: ability_score, feat, skill_proficiency, tool_proficiency, equipment). */
  benefits: { name: string; desc: string; type: string }[];
  api: Schemas['Antecedente'];
}

export interface SrdFeat {
  key: string;
  name: string;
  desc: string;
  /** Categoria do talento ("Origem", "Geral"…). */
  type: string | null;
  prerequisite: string | null;
  benefits: { name: string; desc: string }[];
}

export interface SrdArmorData {
  key: string;
  name: string;
  category: 'light' | 'medium' | 'heavy' | 'shield';
  ac_base: number;
  ac_display: string;
  ac_add_dexmod: boolean;
  ac_cap_dexmod: number | null;
  grants_stealth_disadvantage: boolean;
  strength_score_required: number | null;
}

export interface SrdWeaponData {
  key: string;
  name: string;
  damage_type: { name: string; key: string };
  damage_dice: string;
  properties: { property: { name: string; type: string | null; desc: string }; detail: string | null }[];
  is_simple: boolean;
  is_martial: boolean;
  is_ranged: boolean;
  range: number | null;
  long_range: number | null;
  mastery: string | null;
}

export type SrdItemKind = 'arma' | 'armadura' | 'ferramenta' | 'item';

export interface SrdItem {
  key: string;
  name: string;
  kind: SrdItemKind;
  desc?: string;
  category: { name: string; key: string };
  weapon: SrdWeaponData | null;
  armor: SrdArmorData | null;
  cost?: string | null;
  weight?: string;
}

export interface SrdSpell {
  key: string;
  name: string;
  desc: string;
  level: number;
  school: { key: string; name: string };
  casting_time: string;
  range_text: string;
  duration: string;
  components: string;
  concentration: boolean;
  ritual: boolean;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  higher_level: string | null;
  classes: { key: string; name: string }[];
}

export type { SrdAlignment, SrdLanguage };

// ---------------------------------------------------------------------------
// Conversões

const EDITION_BY_API = Object.fromEntries(Object.entries(SRD_EDITIONS).map(([e, api]) => [api, e])) as Record<
  string,
  SrdEdition
>;

export function sourceOf(fonte: Schemas['ResumoFonte']): SrdSource {
  return { key: String(fonte.id), name: fonte.nome, edition: EDITION_BY_API[fonte.edicao] ?? null };
}

const fromEdition = (edition: SrdEdition) => (r: { fonte: Schemas['ResumoFonte'] }) =>
  sourceOf(r.fonte).edition === edition;

/** Texto da característica com as opções dela (ex.: as transformações da Revelação Celestial). */
function withOptions(desc: string, options: { nome: string; descricao?: string | null }[] = []): string {
  if (options.length === 0) return desc;
  return [desc, ...options.map((o) => `• ${o.nome}${o.descricao ? `: ${o.descricao}` : ''}`)].join('\n');
}

/**
 * Características com os níveis em que aparecem: o da própria característica e os da tabela da classe
 * (ex.: Aumento no Valor de Atributo nos níveis 4, 8, 12…). A mesma característica pode vir mais de uma vez,
 * melhorando em níveis maiores (Golpe Brutal Fortalecido no 13 e no 17): vira uma só, com o texto de cada nível.
 */
function features(owner: string, list: Schemas['Caracteristica'][], table: Schemas['NivelClasse'][] = []): SrdClassFeature[] {
  const same = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;
  const groups: Schemas['Caracteristica'][][] = [];
  for (const c of list) {
    const group = groups.find((g) => same(g[0]!.nome, c.nome));
    if (group) group.push(c);
    else groups.push([c]);
  }
  return groups.map((group) => {
    const first = group[0]!;
    const levels = new Set([
      ...group.map((c) => c.nivel),
      ...table.filter((r) => (r.caracteristicas ?? []).some((n) => same(n, first.nome))).map((r) => r.nivel),
    ]);
    const desc =
      group.length === 1
        ? withOptions(first.descricao, first.opcoes)
        : group.map((c) => `Nível ${c.nivel}: ${withOptions(c.descricao, c.opcoes)}`).join('\n\n');
    return {
      key: `${owner}:${first.nome}`,
      name: first.nome,
      desc,
      gained_at: [...levels].sort((x, y) => x - y).map((level) => ({ level, detail: null })),
    };
  });
}

export function toClass(c: Schemas['Classe']): SrdClassDetail {
  const die = c.dado_vida.match(/d\s*(\d+)/i)?.[1];
  const key = String(c.id);
  return {
    key,
    name: c.nome,
    desc: c.descricao,
    source: sourceOf(c.fonte),
    hit_dice: die ? `d${die}` : c.dado_vida,
    features: features(`classe:${key}`, c.caracteristicas, c.progressao),
    api: c,
  };
}

export function toSubclass(s: Schemas['Subclasse']): SrdClassDetail {
  const key = String(s.id);
  return {
    key,
    name: s.nome,
    desc: [s.subtitulo, s.descricao].filter(Boolean).join('\n\n'),
    source: sourceOf(s.fonte),
    hit_dice: '',
    features: features(`subclasse:${key}`, s.caracteristicas),
  };
}

export function toSpecies(e: Schemas['Especie']): SrdSpeciesGroup {
  return {
    key: String(e.id),
    name: e.nome,
    desc: e.descricao,
    source: sourceOf(e.fonte),
    is_subspecies: false,
    subspecies_of: null,
    subspecies: [],
    traits: [
      { name: 'Tamanho', desc: e.tamanho, type: 'SIZE', order: 0 },
      { name: 'Deslocamento', desc: e.deslocamento, type: 'SPEED', order: 1 },
      ...e.habilidades.map((h, i) => ({ name: h.nome, desc: withOptions(h.descricao, h.opcoes), order: i + 2 })),
    ],
  };
}

export function toBackground(b: Schemas['Antecedente']): SrdBackground {
  const source = sourceOf(b.fonte);
  const equipment = b.equipamento
    .map((o) => `(${o.opcao}) ${[...(o.armas ?? []), ...(o.ferramentas ?? []), ...(o.outros ?? [])].map(itemText).concat(o.ouro ? [`${o.ouro} PO`] : []).join(', ')}`)
    .join('; ou ');
  return {
    key: String(b.id),
    name: b.nome,
    desc: b.descricao,
    document: { key: source.key, name: source.name },
    benefits: [
      { name: 'Valores de Atributo', desc: b.valores_atributo.join(', '), type: 'ability_score' },
      { name: 'Talento', desc: b.talento, type: 'feat' },
      { name: 'Proficiência em Perícias', desc: b.proficiencias_pericias.join(', '), type: 'skill_proficiency' },
      { name: 'Proficiência em Ferramentas', desc: b.proficiencia_ferramentas, type: 'tool_proficiency' },
      { name: 'Equipamento', desc: equipment, type: 'equipment' },
    ].filter((x) => x.desc),
    api: b,
  };
}

const itemText = (i: Schemas['ItemEquipamento']) => (i.quantidade && i.quantidade > 1 ? `${i.quantidade} ${i.nome}` : i.nome);

export function toFeat(t: Schemas['Talento']): SrdFeat {
  return {
    key: String(t.id),
    name: t.nome,
    desc: t.descricao,
    type: t.categoria ?? null,
    prerequisite: t.pre_requisito ?? null,
    benefits: (t.beneficios ?? []).map((b) => ({ name: b.nome, desc: `${b.nome}. ${b.descricao}` })),
  };
}

export function toSpell(m: Schemas['Magia']): SrdSpell {
  const components = m.componentes;
  return {
    key: String(m.id),
    name: m.nome,
    desc: m.descricao,
    level: m.circulo,
    school: { key: m.escola.toLowerCase(), name: m.escola },
    casting_time: m.tempo_conjuracao,
    range_text: m.alcance,
    duration: m.duracao,
    components,
    concentration: /concentra/i.test(m.duracao),
    ritual: /ritual/i.test(`${m.tempo_conjuracao} ${m.escola}`),
    verbal: /\bV\b/.test(components),
    somatic: /\bS\b/.test(components),
    material: /\bM\b/.test(components),
    higher_level: m.circulo_superior ?? m.aprimoramento_truque ?? null,
    classes: m.classes.map((c) => ({ key: String(c.id), name: c.nome })),
  };
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** "1d8 Cortante" → dado + tipo de dano. */
function parseDamage(text: string) {
  const dice = text.match(/\d+d\d+(?:\s*[+-]\s*\d+)?|^\d+\b/)?.[0]?.replace(/\s+/g, '') ?? text;
  const type = text.replace(dice, '').replace(/^[\s,;-]+/, '').trim();
  return { dice, type: { name: type, key: slug(type) } };
}

/** "Arremesso (Distância 6/18)" → nome + detalhe; o alcance sai do detalhe. */
function parseProperty(text: string) {
  const match = text.match(/^([^(]+?)\s*(?:\(([^)]*)\))?$/);
  return { name: match?.[1]?.trim() ?? text, detail: match?.[2]?.trim() || null };
}

export function toWeapon(a: Schemas['Arma']): SrdItem {
  const key = `arma:${a.id}`;
  const damage = parseDamage(a.dano);
  const properties = a.propriedades.map(parseProperty);
  const range = a.propriedades.join(' ').match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  const num = (s?: string) => (s ? Number(s.replace(',', '.')) : null);
  const is_simple = /simples/i.test(a.categoria);
  const weapon: SrdWeaponData = {
    key,
    name: a.nome,
    damage_type: damage.type,
    damage_dice: damage.dice,
    properties: properties.map((p) => ({ property: { name: p.name, type: null, desc: '' }, detail: p.detail })),
    is_simple,
    is_martial: !is_simple,
    is_ranged: /dist[âa]ncia/i.test(a.tipo),
    range: num(range?.[1]),
    long_range: num(range?.[2]),
    mastery: a.maestria || null,
  };
  return {
    key,
    name: a.nome,
    kind: 'arma',
    category: { name: a.categoria, key: 'weapon' },
    weapon,
    armor: null,
    cost: a.custo,
    weight: a.peso,
  };
}

/** "Leve"/"Armadura Média"/"Escudo" → categoria. */
function armorCategory(text: string): SrdArmorData['category'] {
  const s = slug(text);
  if (s.includes('escudo')) return 'shield';
  if (s.includes('pesada')) return 'heavy';
  if (s.includes('media')) return 'medium';
  return 'light';
}

export function toArmor(a: Schemas['Armadura']): SrdItem {
  const key = `armadura:${a.id}`;
  const category = armorCategory(`${a.categoria} ${a.nome}`);
  // "11 + modificador de Des", "12 + mod. Des (máx. 2)", "16", "+2"
  const ac = a.classe_armadura;
  const cap = ac.match(/m[áa]x(?:imo)?\.?\s*(?:de\s*)?\+?(\d+)/i)?.[1];
  const armor: SrdArmorData = {
    key,
    name: a.nome,
    category,
    ac_base: Number(ac.match(/\d+/)?.[0] ?? (category === 'shield' ? 2 : 10)),
    ac_display: ac,
    ac_add_dexmod: /des/i.test(ac),
    ac_cap_dexmod: cap ? Number(cap) : null,
    grants_stealth_disadvantage: !!a.furtividade && /desvantagem/i.test(a.furtividade),
    strength_score_required: a.forca ? Number(a.forca.match(/\d+/)?.[0] ?? 0) || null : null,
  };
  return {
    key,
    name: a.nome,
    kind: 'armadura',
    category: { name: a.categoria, key: category === 'shield' ? 'shield' : 'armor' },
    weapon: null,
    armor,
    cost: a.custo,
    weight: a.peso,
  };
}

export function toTool(f: Schemas['Ferramenta']): SrdItem {
  return {
    key: `ferramenta:${f.id}`,
    name: f.nome,
    kind: 'ferramenta',
    desc: f.usar_objeto,
    category: { name: f.categoria, key: 'tools' },
    weapon: null,
    armor: null,
    cost: f.custo,
    weight: f.peso,
  };
}

export function toGear(i: Schemas['ItemAventura']): SrdItem {
  return {
    key: `item:${i.id}`,
    name: i.nome,
    kind: 'item',
    desc: i.descricao,
    category: { name: 'Equipamento de Aventura', key: 'adventuring-gear' },
    weapon: null,
    armor: null,
    cost: i.custo,
    weight: i.peso,
  };
}

// ---------------------------------------------------------------------------
// Consultas

/** Máximo por página na API. */
const PAGE = 100;

type Page<T> = { data?: T[]; error?: unknown; response: Response };

/** Busca todas as páginas de uma coleção. */
async function all<T>(resource: string, fetchPage: (pagina: number) => Promise<Page<T>>): Promise<T[]> {
  const result: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error, response } = await fetchPage(pagina);
    if (error || !data) throw new SrdError(resource, error ?? response.status);
    result.push(...data);
    if (data.length < PAGE) return result;
  }
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const numericId = (key: string) => (/^\d+$/.test(key) ? Number(key) : null);

/**
 * Consultas da 5e-FastAPI usadas pelo app, por edição (2014 = livros "5e", 2024 = livros "5.5e").
 * Só traz dados de regra; o que o jogador escolheu fica no PocketBase.
 */
export function createSrdCatalog(client: SrdClient) {
  const query = (pagina: number) => ({ params: { query: { pagina, limite: PAGE } } });

  const allClasses = () => all('classes', (p) => client.GET('/api/v1/classes', query(p)));
  const allWeapons = () => all('armas', (p) => client.GET('/api/v1/equipamentos/armas', query(p)));
  const allArmor = () => all('armaduras', (p) => client.GET('/api/v1/equipamentos/armaduras', query(p)));
  const allTools = () => all('ferramentas', (p) => client.GET('/api/v1/equipamentos/ferramentas', query(p)));
  const allGear = () => all('itens', (p) => client.GET('/api/v1/equipamentos/itens', query(p)));

  /** Um registro por id; 404 vira `null` (chave de um personagem antigo, registro removido…). */
  async function one<T>(resource: string, request: Promise<{ data?: T; error?: unknown; response: Response }>) {
    const { data, error, response } = await request;
    if (response.status === 404) return null;
    if (error || !data) throw new SrdError(resource, error ?? response.status);
    return data;
  }

  return {
    /** Livros cadastrados na API. */
    async sources(): Promise<SrdSource[]> {
      const list = await all('fontes', (p) => client.GET('/api/v1/fontes', { params: { query: { pagina: p, limite: PAGE } } }));
      return list.map((f) => ({ key: String(f.id), name: f.nome, edition: EDITION_BY_API[f.edicao] ?? null }));
    },

    async classes(edition: SrdEdition): Promise<SrdClass[]> {
      return (await allClasses()).filter(fromEdition(edition)).map(toClass).sort(byName);
    },

    /** Classe completa: características, progressão, equipamento e proficiências. */
    async classDetail(key: string): Promise<SrdClassDetail> {
      const id = numericId(key);
      const data = id && (await one(`classe ${key}`, client.GET('/api/v1/classes/{classe_id}', { params: { path: { classe_id: id } } })));
      if (!data) throw new SrdError(`classe ${key}`, 404);
      return toClass(data);
    },

    async subclasses(classKey: string): Promise<SrdClassDetail[]> {
      const classe_id = numericId(classKey);
      if (!classe_id) return [];
      const list = await all('subclasses', (pagina) =>
        client.GET('/api/v1/subclasses', { params: { query: { classe_id, pagina, limite: PAGE } } }),
      );
      return list.map(toSubclass).sort(byName);
    },

    async species(edition: SrdEdition): Promise<SrdSpeciesGroup[]> {
      const list = await all('espécies', (p) => client.GET('/api/v1/especies', query(p)));
      return list.filter(fromEdition(edition)).map(toSpecies).sort(byName);
    },

    async backgrounds(edition: SrdEdition): Promise<SrdBackground[]> {
      const list = await all('antecedentes', (p) => client.GET('/api/v1/antecedentes', query(p)));
      return list.filter(fromEdition(edition)).map(toBackground).sort(byName);
    },

    async feats(edition: SrdEdition): Promise<SrdFeat[]> {
      const list = await all('talentos', (p) => client.GET('/api/v1/talentos', query(p)));
      return list.filter(fromEdition(edition)).map(toFeat).sort(byName);
    },

    /** Armas, armaduras, ferramentas e equipamento de aventura da edição. */
    async items(edition: SrdEdition): Promise<SrdItem[]> {
      const [weapons, armor, tools, gear] = await Promise.all([allWeapons(), allArmor(), allTools(), allGear()]);
      const keep = fromEdition(edition);
      return [
        ...weapons.filter(keep).map(toWeapon),
        ...armor.filter(keep).map(toArmor),
        ...tools.filter(keep).map(toTool),
        ...gear.filter(keep).map(toGear),
      ];
    },

    /** Itens por chave ("arma:3", "armadura:1"…), para montar a ficha. */
    async itemsByKey(keys: string[]): Promise<SrdItem[]> {
      const found = await Promise.all(
        [...new Set(keys)].map(async (key) => {
          const [kind, raw] = key.split(':');
          const id = numericId(raw ?? '');
          if (!id) return null;
          switch (kind as SrdItemKind) {
            case 'arma': {
              const r = await one(key, client.GET('/api/v1/equipamentos/armas/{arma_id}', { params: { path: { arma_id: id } } }));
              return r && toWeapon(r);
            }
            case 'armadura': {
              const r = await one(key, client.GET('/api/v1/equipamentos/armaduras/{armadura_id}', { params: { path: { armadura_id: id } } }));
              return r && toArmor(r);
            }
            case 'ferramenta': {
              const r = await one(key, client.GET('/api/v1/equipamentos/ferramentas/{ferramenta_id}', { params: { path: { ferramenta_id: id } } }));
              return r && toTool(r);
            }
            case 'item': {
              const r = await one(key, client.GET('/api/v1/equipamentos/itens/{item_id}', { params: { path: { item_id: id } } }));
              return r && toGear(r);
            }
            default:
              return null;
          }
        }),
      );
      return found.filter((i): i is SrdItem => !!i);
    },

    /** Magias da lista de uma classe, até o círculo `maxLevel` (0 = truques). */
    async spells(classKey: string, maxLevel: number): Promise<SrdSpell[]> {
      const classe_id = numericId(classKey);
      if (!classe_id) return [];
      const list = await all('magias', (pagina) =>
        client.GET('/api/v1/magias', { params: { query: { classe_id, pagina, limite: PAGE } } }),
      );
      return list
        .filter((m) => m.circulo <= maxLevel)
        .map(toSpell)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    },

    async spellsByKey(keys: string[]): Promise<SrdSpell[]> {
      const found = await Promise.all(
        [...new Set(keys)].map(async (key) => {
          const magia_id = numericId(key);
          if (!magia_id) return null;
          const r = await one(`magia ${key}`, client.GET('/api/v1/magias/{magia_id}', { params: { path: { magia_id } } }));
          return r && toSpell(r);
        }),
      );
      return found.filter((s): s is SrdSpell => !!s).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    },

    /** Ainda não há endpoint de alinhamentos/idiomas na API: vêm das listas do Livro do Jogador. */
    async alignments(): Promise<SrdAlignment[]> {
      return ALIGNMENTS;
    },

    async languages(): Promise<SrdLanguage[]> {
      return LANGUAGES;
    },
  };
}

export type SrdCatalog = ReturnType<typeof createSrdCatalog>;

export class SrdError extends Error {
  constructor(resource: string, cause?: unknown) {
    super(`Falha ao buscar ${resource} na 5e-FastAPI.`, { cause });
    this.name = 'SrdError';
  }
}
