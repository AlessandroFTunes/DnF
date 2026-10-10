import { ABILITIES, abilityModifier, type Ability, type AbilityScores } from '@dnf/core/character';
import type { components } from './5e-fastapi';
import type {
  SrdArmorData,
  SrdBackground,
  SrdClassDetail,
  SrdClassFeature,
  SrdItem,
  SrdItemKind,
  SrdSpecies,
} from './catalog';
import { ABILITY_NAMES, SKILLS, type SrdSkill } from './reference';

type Schemas = components['schemas'];

/**
 * Regras de criação e da ficha lidas dos dados da 5e-FastAPI.
 * A API já entrega quase tudo estruturado (salvaguardas, perícias do antecedente, progressão, opções
 * de equipamento); o que ainda vem como texto (ex.: "Escolha 2: Atletismo, …") vira estrutura aqui.
 * Nada é inventado: se o texto não for reconhecido, a escolha fica livre.
 */

// ---------------------------------------------------------------------------
// Básico

/** Sem acentos e em minúsculas, para comparar nomes. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const ABILITY_BY_NAME: Record<string, Ability> = Object.fromEntries(
  ABILITIES.map((a) => [normalize(ABILITY_NAMES[a]), a]),
);
const ABILITY_PATTERN = /for[çc]a|destreza|constitui[çc][ãa]o|intelig[êe]ncia|sabedoria|carisma/gi;

export function abilityFromName(name: string): Ability | undefined {
  return ABILITY_BY_NAME[normalize(name)];
}

/** Atributos citados num texto, na ordem em que aparecem. */
export function abilitiesIn(text: string): Ability[] {
  const found = [...text.matchAll(ABILITY_PATTERN)];
  return [...new Set(found.map((m) => ABILITY_BY_NAME[normalize(m[0])]!))];
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
};

function toNumber(word: string | undefined): number | undefined {
  if (!word) return undefined;
  const n = Number(word);
  return Number.isFinite(n) ? n : NUMBER_WORDS[normalize(word)];
}

/** Remove a marcação (negrito, itálico, títulos) para mostrar como texto corrido. */
export function plainText(text = ''): string {
  return text
    .replace(/^[ \t]*\|?[ \t]*:?[-—–]{2,}.*$/gm, '')
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, row: string) => {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      return cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(' · ')}` : (cells[0] ?? '');
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*|__|[*_]/g, '')
    .replace(/^#+\s*/gm, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Perícias

export type SkillInfo = SrdSkill;

/** Lista de perícias (a API ainda não tem endpoint de perícias: ver `reference.ts`). */
export function skillsFromAbilities(): SkillInfo[] {
  return SKILLS;
}

const skillNames = (s: SkillInfo) => [s.name, ...(s.aliases ?? [])].map(normalize);

/** Perícia pelo nome em português. */
export function skillKey(name: string, skills: SkillInfo[] = SKILLS): string | undefined {
  const wanted = normalize(name);
  return skills.find((s) => skillNames(s).includes(wanted))?.key;
}

/** Nomes de perícias citados num texto → chaves (na ordem da lista). */
export function skillKeysIn(text: string, skills: SkillInfo[] = SKILLS): string[] {
  const lower = normalize(text);
  return skills.filter((s) => skillNames(s).some((n) => lower.includes(n))).map((s) => s.key);
}

export interface SkillChoice {
  count: number;
  /** null = qualquer perícia. */
  options: string[] | null;
}

/** "Escolha 2: Atletismo, Intimidação … ou Sobrevivência" / "Escolha 3 perícias quaisquer". */
export function parseSkillChoice(text: string, skills: SkillInfo[] = SKILLS): SkillChoice {
  const plain = normalize(text);
  const count = toNumber(plain.match(/escolha\s+(\w+)/)?.[1]) ?? 2;
  if (/quaisquer|qualquer|a sua escolha/.test(plain)) return { count, options: null };
  const options = skillKeysIn(plain, skills);
  return { count, options: options.length ? options : null };
}

// ---------------------------------------------------------------------------
// Tabela da classe

const levelRow = (cls: SrdClassDetail, level: number) =>
  (cls.api?.progressao ?? []).filter((r) => r.nivel <= level).sort((a, b) => b.nivel - a.nivel)[0];

/** Valor de uma coluna da tabela da classe num nível (nome da coluna por expressão regular). */
export function tableValue(cls: SrdClassDetail, column: RegExp, level: number): string | undefined {
  return levelRow(cls, level)?.colunas?.find((c) => column.test(c.nome))?.valor;
}

const tableNumber = (cls: SrdClassDetail, column: RegExp, level: number) => {
  const n = parseInt((tableValue(cls, column, level) ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

const PACT_SLOTS = /^espa[çc]os de magia$/i;
const PACT_LEVEL = /(c[íi]rculo|n[íi]vel) (do|dos) espa[çc]o/i;

/** Espaços de magia por círculo ("1"…"9") no nível de personagem dado. */
export function spellSlots(cls: SrdClassDetail, level: number): Partial<Record<string, number>> {
  const slots: Partial<Record<string, number>> = {};
  (levelRow(cls, level)?.espacos_magia ?? []).forEach((n, i) => {
    if (n > 0) slots[String(i + 1)] = n;
  });
  // Bruxo (Magia de Pacto): todos os espaços no mesmo círculo, em colunas próprias.
  const pact = tableNumber(cls, PACT_SLOTS, level);
  if (pact > 0) slots[String(tableNumber(cls, PACT_LEVEL, level) || 1)] = pact;
  return slots;
}

const minLevel = (f: SrdClassFeature) => Math.min(...f.gained_at.map((g) => g.level), 99);

const ASI = /aumento no valor de atributo/i;

/** Características ganhas até o nível. */
export function classFeaturesUpTo(cls: SrdClassDetail, level: number): SrdClassFeature[] {
  return cls.features
    .filter((f) => f.gained_at.some((g) => g.level <= level))
    .sort((a, b) => minLevel(a) - minLevel(b) || a.name.localeCompare(b.name));
}

/** Nível em que se escolhe a subclasse ("Subclasse de Bárbaro"); sem ela, o menor nível das subclasses. */
export function subclassLevel(subclasses: SrdClassDetail[], cls: SrdClassDetail): number {
  const granting = cls.features.find((f) => /^subclasse/i.test(f.name));
  if (granting) return minLevel(granting);
  const levels = subclasses.flatMap((s) => s.features.flatMap((f) => f.gained_at.map((g) => g.level)));
  return levels.length ? Math.min(...levels) : 3;
}

/** Níveis com Aumento no Valor de Atributo (ou talento), pela tabela da classe. */
export function asiLevels(cls: SrdClassDetail): number[] {
  const fromTable = (cls.api?.progressao ?? []).filter((r) => (r.caracteristicas ?? []).some((c) => ASI.test(c))).map((r) => r.nivel);
  const fromFeature = cls.features.filter((f) => ASI.test(f.name)).flatMap((f) => f.gained_at.map((g) => g.level));
  return [...new Set([...fromTable, ...fromFeature])].sort((a, b) => a - b);
}

/** Características por nível (sem o Aumento no Valor de Atributo), para a árvore de evolução. */
export function featuresByLevel(cls: SrdClassDetail): Map<number, SrdClassFeature[]> {
  const map = new Map<number, SrdClassFeature[]>();
  for (const f of cls.features) {
    if (ASI.test(f.name)) continue;
    for (const g of f.gained_at) map.set(g.level, [...(map.get(g.level) ?? []), f]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Classe

export interface ClassRules {
  hitDie: number;
  savingThrows: Ability[];
  skillChoice: SkillChoice;
  armorTraining: string;
  weaponTraining: string;
  toolTraining: string;
  /** Categorias de armadura que a classe sabe usar (+ "shield"). */
  armorProficiencies: Set<'light' | 'medium' | 'heavy' | 'shield'>;
  equipment: EquipmentChoice[];
  spellcasting: SpellcastingRules | null;
  /** Especialização no 1º nível (Ladino): quantas perícias dobram o bônus. */
  expertiseAtLevel1: number;
  /** Defesa sem Armadura: atributo somado à Destreza (Bárbaro: con, Monge: wis). */
  unarmoredDefense: Ability | null;
}

const featureAt1 = (cls: SrdClassDetail, name: RegExp) => cls.features.find((f) => name.test(f.name) && minLevel(f) <= 1);

export function classRules(cls: SrdClassDetail, skills: SkillInfo[] = SKILLS): ClassRules {
  const api = cls.api;
  const armorTraining = api?.treinamento_armaduras ?? '';
  const unarmored = featureAt1(cls, /^defesa sem armadura$/i);
  return {
    hitDie: parseInt(cls.hit_dice.replace(/\D/g, ''), 10) || 8,
    savingThrows: (api?.proficiencias_salvaguardas ?? []).map(abilityFromName).filter((a): a is Ability => !!a),
    skillChoice: parseSkillChoice(api?.proficiencias_pericias ?? '', skills),
    armorTraining,
    weaponTraining: api?.proficiencias_armas ?? '',
    toolTraining: '',
    armorProficiencies: parseArmorTraining(armorTraining),
    equipment: api && api.equipamento.length ? [equipmentChoice(api.equipamento)] : [],
    spellcasting: spellcastingRules(cls),
    expertiseAtLevel1: featureAt1(cls, /^especializa[çc][ãa]o$/i) ? 2 : 0,
    unarmoredDefense: unarmored ? (abilitiesIn(unarmored.desc).find((a) => a === 'con' || a === 'wis') ?? null) : null,
  };
}

/** "Armaduras Leve e Média e Escudos" → categorias. */
function parseArmorTraining(text: string): ClassRules['armorProficiencies'] {
  const lower = normalize(text);
  const set: ClassRules['armorProficiencies'] = new Set();
  if (/todas/.test(lower)) ['light', 'medium', 'heavy'].forEach((c) => set.add(c as 'light'));
  if (/\bleves?\b/.test(lower)) set.add('light');
  if (/\bmedias?\b/.test(lower)) set.add('medium');
  if (/\bpesadas?\b/.test(lower)) set.add('heavy');
  if (/escudo/.test(lower)) set.add('shield');
  return set;
}

// ---------------------------------------------------------------------------
// Conjuração

export interface SpellcastingRules {
  ability: Ability;
  /** Truques no 1º nível. */
  cantrips: number;
  /** Magias de 1º círculo no 1º nível; `null` = atributo + nível. */
  spells: number | null;
  /** Espaços de 1º círculo no 1º nível. */
  slots: number;
  /** Prepara magias da lista inteira em vez de escolher uma quantidade fixa. */
  preparesFromList: boolean;
  /** Com `spells: null`: atributo + metade do nível, em vez do nível inteiro (Artífice de 2014). */
  halfLevel?: boolean;
}

const CASTING_FEATURE = /^(conjura[çc][ãa]o|magia de pacto)$/i;

/** Atributo de conjuração da classe (mesmo que ela só conjure em níveis mais altos). */
export function spellcastingAbility(cls: SrdClassDetail): Ability | null {
  const desc = cls.features.find((f) => CASTING_FEATURE.test(f.name))?.desc ?? '';
  if (!desc) return null;
  // "Inteligência é sua habilidade de conjuração" / "seu atributo de conjuração é Carisma"
  const sentence = desc.split(/(?<=[.!?])\s+/).find((s) => /(habilidade|atributo) de conjura/i.test(s)) ?? '';
  return abilitiesIn(sentence)[0] ?? abilitiesIn(desc).find((a) => a === 'int' || a === 'wis' || a === 'cha') ?? null;
}

export function spellcastingRules(cls: SrdClassDetail): SpellcastingRules | null {
  const ability = spellcastingAbility(cls);
  if (!ability) return null;
  const cantrips = tableNumber(cls, /truques/i, 1);
  const spells = tableNumber(cls, /magias (preparadas|conhecidas)/i, 1);
  const slots = spellSlots(cls, 1)['1'] ?? 0;
  if (cantrips === 0 && spells === 0) return null; // só conjura em níveis mais altos
  // Classes de 2014 sem coluna de magias (Artífice): prepara "modificador + (metade do) nível", como diz o texto.
  if (spells === 0 && slots > 0) {
    const desc = cls.features.find((f) => CASTING_FEATURE.test(f.name))?.desc ?? '';
    return { ability, cantrips, spells: null, slots, preparesFromList: false, halfLevel: /metade do seu n[íi]vel/i.test(desc) };
  }
  return { ability, cantrips, spells, slots, preparesFromList: false };
}

/** Quantas magias de 1º círculo escolher, já resolvendo "atributo + nível". */
export function spellsToChoose(rules: SpellcastingRules, scores: AbilityScores, level = 1): number {
  return rules.spells ?? Math.max(1, abilityModifier(scores[rules.ability]) + (rules.halfLevel ? Math.floor(level / 2) : level));
}

// ---------------------------------------------------------------------------
// Equipamento

export interface ItemRef {
  /** Texto original (ex.: "4 Machadinha"). */
  text: string;
  name: string;
  quantity: number;
  /** Em que lista procurar o item. */
  kind?: SrdItemKind;
  /** Arma genérica a escolher ("uma arma Marcial"). */
  pick?: 'simple' | 'martial';
}

export interface EquipmentOption {
  id: string;
  label: string;
  items: ItemRef[];
  gp: number;
}

export interface EquipmentChoice {
  options: EquipmentOption[];
}

type ApiEquipmentOption = Schemas['OpcaoEquipamento'] & { armaduras?: Schemas['ItemEquipamento'][] };

/** Opções A/B da classe ou do antecedente, já estruturadas pela API. */
export function equipmentChoice(options: ApiEquipmentOption[]): EquipmentChoice {
  return {
    options: options.map((o) => {
      const refs = (list: Schemas['ItemEquipamento'][] | undefined, kind: SrdItemKind) =>
        (list ?? []).map((i) => itemRef(i, kind));
      const items = [
        ...refs(o.armas, 'arma'),
        ...refs(o.armaduras, 'armadura'),
        ...refs(o.ferramentas, 'ferramenta'),
        ...refs(o.outros, 'item'),
      ];
      const gp = o.ouro ?? 0;
      const label = [...items.map((i) => i.text), ...(gp ? [`${gp} PO`] : [])].join(', ');
      return { id: o.opcao, label, items, gp };
    }),
  };
}

function itemRef(i: Schemas['ItemEquipamento'], kind: SrdItemKind): ItemRef {
  const quantity = i.quantidade ?? 1;
  const weapon = normalize(i.nome).match(/\barmas?\b.*\b(simples|marcia(?:l|is))\b/);
  return {
    text: quantity > 1 ? `${quantity} ${i.nome}` : i.nome,
    name: i.nome,
    quantity,
    kind,
    pick: weapon ? (weapon[1] === 'simples' ? 'simple' : 'martial') : undefined,
  };
}

const itemName = (s: string) => normalize(s).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
/** Formas singulares possíveis ("machadinhas" → machadinha; "aljavas" → aljava; "virotes" → virote). */
const singulars = (s: string) => [s, s.replace(/oes$/, 'ao').replace(/aes$/, 'ao'), s.replace(/es$/, ''), s.replace(/s$/, '')];

/** Acha o item da API pelo nome escrito no equipamento inicial. */
export function findItem(name: string, items: SrdItem[], kind?: SrdItemKind): SrdItem | undefined {
  // "Kit de Jogos (o mesmo que acima)", "Instrumento Musical à sua escolha": a escolha é do jogador.
  if (/mesm[oa] que acima|qualquer|a sua escolha/.test(normalize(name))) return undefined;
  const wanted = itemName(name);
  const exact = (pool: SrdItem[]) =>
    pool.find((i) => normalize(i.name) === normalize(name)) ??
    singulars(wanted).map((v) => pool.find((i) => itemName(i.name) === v)).find(Boolean);
  return (kind && exact(items.filter((i) => i.kind === kind))) || exact(items);
}

/** Quantidade em unidades do item: "20 Flechas" com o item "Flechas (20)" é 1 pacote. */
export function itemQuantity(ref: ItemRef, item: SrdItem): number {
  const bundle = Number(item.name.match(/\((\d+)\)/)?.[1]);
  return bundle && ref.quantity % bundle === 0 ? ref.quantity / bundle : ref.quantity;
}

export const isShield = (item: Pick<SrdItem, 'armor'>) => item.armor?.category === 'shield';

export const isBodyArmor = (item: Pick<SrdItem, 'armor'>) => !!item.armor && !isShield(item);

// ---------------------------------------------------------------------------
// Espécie

export interface SpeciesRules {
  /** Como no livro ("9 metros"). */
  speed: string;
  size: string;
  /** Bônus fixos de atributo (regras de 2014). */
  abilityBonuses: Partial<Record<Ability, number>>;
  /** "+1 em dois outros à sua escolha" (regras de 2014). */
  abilityChoice: { count: number; amount: number } | null;
  skills: string[];
  skillChoice: SkillChoice | null;
  languages: string[];
  extraLanguages: number;
  /** PV extra por nível (Tenacidade Anã). */
  hpPerLevel: number;
  /** Talento de origem à escolha (Humano). */
  originFeat: boolean;
  traits: { name: string; desc: string }[];
}

/** Junta espécie base e subespécie (as duas listas de traços valem). */
export function speciesRules(chain: SrdSpecies[], skills: SkillInfo[] = SKILLS, _languageNames: string[] = []): SpeciesRules {
  const rules: SpeciesRules = {
    speed: '',
    size: '',
    abilityBonuses: {},
    abilityChoice: null,
    skills: [],
    skillChoice: null,
    languages: [],
    extraLanguages: 0,
    hpPerLevel: 0,
    originFeat: false,
    traits: [],
  };

  for (const trait of chain.flatMap((s) => s.traits)) {
    if (trait.type === 'SPEED') {
      rules.speed = trait.desc;
      continue;
    }
    if (trait.type === 'SIZE') {
      rules.size = sizeLabel(trait.desc);
      continue;
    }
    const desc = normalize(trait.desc);
    if (/pontos de vida maximos aumentam em 1|maximo de pontos de vida aumenta em 1/.test(desc)) rules.hpPerLevel += 1;
    if (/talento de origem/.test(desc)) rules.originFeat = true;

    const grant = parseSkillGrant(trait.desc, skills);
    if (grant.fixed.length) rules.skills.push(...grant.fixed);
    if (grant.choice) rules.skillChoice = grant.choice;

    rules.traits.push({ name: trait.name, desc: plainText(trait.desc) });
  }
  return rules;
}

/** "Médio (cerca de 1,20-2,10 metros) ou Pequeno (…), escolhido ao selecionar…" → "Médio ou Pequeno". */
export function sizeLabel(text: string): string {
  return text
    .replace(/\([^)]*\)/g, '')
    .split(',')[0]!
    .replace(/\s+/g, ' ')
    .trim();
}

/** "proficiência na perícia Percepção" (fixa) / "Intuição, Percepção ou Sobrevivência" / "uma perícia à sua escolha". */
function parseSkillGrant(text: string, skills: SkillInfo[]): { fixed: string[]; choice: SkillChoice | null } {
  const desc = normalize(text);
  if (!/proficiencia/.test(desc) || !/pericia/.test(desc)) return { fixed: [], choice: null };
  const anyChoice = desc.match(/proficiencia em (\w+) pericias? a sua escolha/);
  if (anyChoice) return { fixed: [], choice: { count: toNumber(anyChoice[1]) ?? 1, options: null } };
  const sentence = desc.match(/proficiencia (?:na|nas|em) pericias? ([^.]*)/)?.[1] ?? '';
  const keys = skillKeysIn(sentence, skills);
  if (keys.length > 1 && /\bou\b/.test(sentence)) return { fixed: [], choice: { count: 1, options: keys } };
  return { fixed: keys, choice: null };
}

// ---------------------------------------------------------------------------
// Antecedente

export interface BackgroundRules {
  skills: string[];
  skillChoice: SkillChoice | null;
  /** Os três atributos que o antecedente pode aumentar. */
  abilityOptions: Ability[];
  /** Talento de origem ("Iniciado em Magia (Clérigo)" → nome + lista de magias). */
  feat: { name: string; spellList: string | null } | null;
  tools: string;
  languagesToChoose: number;
  equipment: EquipmentChoice | null;
}

export function backgroundRules(bg: SrdBackground, skills: SkillInfo[] = SKILLS): BackgroundRules {
  const api = bg.api;
  // "Iniciado em Magia (Clérigo) (veja o capítulo 5)"
  const featText = api.talento.replace(/\s*\(veja[^)]*\)/gi, '').trim();
  const featMatch = featText.match(/^([^(]+?)\s*(?:\(([^)]+)\))?$/);
  return {
    skills: api.proficiencias_pericias.map((n) => skillKey(n, skills)).filter((k): k is string => !!k),
    skillChoice: null,
    abilityOptions: api.valores_atributo.map(abilityFromName).filter((a): a is Ability => !!a),
    feat: featText ? { name: featMatch?.[1]?.trim() ?? featText, spellList: featMatch?.[2]?.trim() ?? null } : null,
    tools: api.proficiencia_ferramentas.replace(/\s*\(veja[^)]*\)/gi, '').trim(),
    languagesToChoose: 0,
    equipment: api.equipamento.length ? equipmentChoice(api.equipamento) : null,
  };
}

/** Talento de origem que dá magias de uma lista de classe. */
export const MAGIC_INITIATE = 'Iniciado em Magia';

/** PV extras por nível vindos de talentos (ex.: Vigoroso/Robusto: "o dobro do seu nível"). */
export function featHitPointsPerLevel(feats: { benefits?: { desc?: string }[]; desc?: string }[]): number {
  return feats.reduce((sum, f) => {
    const text = normalize([f.desc, ...(f.benefits ?? []).map((b) => b.desc)].join(' '));
    return sum + (/(duas vezes|o dobro d)o? seu nivel/.test(text) ? 2 : 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Atributos

/** Custo de compra por pontos (27 pontos, valores de 8 a 15). */
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;

/** Aumento de atributo dado por uma característica (Campeão Primitivo, Corpo e Mente…). */
export interface FeatureAbilityIncrease {
  abilities: Ability[];
  amount: number;
  /** Valor máximo depois do aumento ("até um máximo de 25"). */
  max: number;
}

/** Lê "Seus valores de Força e Constituição aumentam em 4, até um máximo de 25" da descrição. */
export function abilityIncreaseOf(desc: string): FeatureAbilityIncrease | null {
  const text = normalize(desc);
  const match = text.match(/(?:seus valores|seu valor) de ([^.]*?) aument\w* em (\d+)([^.]*)/);
  if (!match) return null;
  const abilities = abilitiesIn(match[1]!);
  if (abilities.length === 0) return null;
  const max = Number(match[3]?.match(/maximo de (\d+)/)?.[1] ?? 20);
  return { abilities, amount: Number(match[2]), max };
}

/**
 * Valores de atributo com os aumentos das características já ganhas (a ficha guarda os valores base e as
 * escolhas do jogador; o que vem de característica é lido da API). Nunca diminui um valor já acima do máximo.
 */
export function applyFeatureIncreases(scores: AbilityScores, features: { desc: string }[]): AbilityScores {
  const result = { ...scores };
  for (const feature of features) {
    const increase = abilityIncreaseOf(feature.desc);
    if (!increase) continue;
    for (const a of increase.abilities) result[a] = Math.max(result[a], Math.min(increase.max, result[a] + increase.amount));
  }
  return result;
}

/** Soma os bônus e limita a 20 (máximo na criação). */
export function applyBonuses(base: AbilityScores, ...bonuses: Partial<Record<Ability, number>>[]): AbilityScores {
  const result = { ...base };
  for (const bonus of bonuses) for (const a of ABILITIES) result[a] = Math.min(20, result[a] + (bonus[a] ?? 0));
  return result;
}

// ---------------------------------------------------------------------------
// Valores da ficha

export interface ArmorClassResult {
  value: number;
  /** Ex.: "Couro (11) + Des (+2) + Escudo (+2)". */
  parts: { label: string; value: number }[];
}

export function armorClass(input: {
  scores: AbilityScores;
  armor: SrdArmorData | null;
  armorName?: string;
  shield: boolean;
  unarmoredDefense: Ability | null;
}): ArmorClassResult {
  const dex = abilityModifier(input.scores.dex);
  const parts: ArmorClassResult['parts'] = [];
  if (input.armor) {
    parts.push({ label: input.armorName ?? input.armor.name, value: input.armor.ac_base });
    if (input.armor.ac_add_dexmod) {
      const cap = input.armor.ac_cap_dexmod;
      parts.push({ label: 'DES', value: cap != null ? Math.min(dex, cap) : dex });
    }
  } else {
    parts.push({ label: 'Base', value: 10 }, { label: 'DES', value: dex });
    // Monge perde a Defesa sem Armadura usando escudo.
    const extra = input.unarmoredDefense;
    if (extra && !(extra === 'wis' && input.shield)) {
      parts.push({ label: extra === 'con' ? 'CON' : 'SAB', value: abilityModifier(input.scores[extra]) });
    }
  }
  if (input.shield) parts.push({ label: 'Escudo', value: 2 });
  return { value: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

/** PV máximos: dado cheio no 1º nível, média arredondada para cima depois (+ CON por nível). */
export function hitPointMax(hitDie: number, level: number, conScore: number, extraPerLevel = 0): number {
  const con = abilityModifier(conScore);
  const first = hitDie + con;
  const later = (level - 1) * (Math.floor(hitDie / 2) + 1 + con);
  return Math.max(1, first + later + extraPerLevel * level);
}

export function skillBonus(
  skill: SkillInfo,
  scores: AbilityScores,
  proficiency: 'proficient' | 'expertise' | undefined,
  proficiencyBonus: number,
): number {
  const mod = abilityModifier(scores[skill.ability]);
  if (proficiency === 'expertise') return mod + proficiencyBonus * 2;
  if (proficiency === 'proficient') return mod + proficiencyBonus;
  return mod;
}

const propertyNames = (weapon: NonNullable<SrdItem['weapon']>) => weapon.properties.map((p) => normalize(p.property.name));

/** Ataque/dano de uma arma: Acuidade usa o melhor entre FOR e DES; à distância usa DES. */
export function weaponAttack(weapon: SrdItem['weapon'], scores: AbilityScores, proficiencyBonus: number, proficient: boolean) {
  if (!weapon) return null;
  const props = propertyNames(weapon);
  const str = abilityModifier(scores.str);
  const dex = abilityModifier(scores.dex);
  const mod = props.includes('acuidade') ? Math.max(str, dex) : weapon.is_ranged ? dex : str;
  return {
    toHit: mod + (proficient ? proficiencyBonus : 0),
    damage: `${weapon.damage_dice}${mod === 0 ? '' : mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`}`,
    damageType: weapon.damage_type.name,
    properties: weapon.properties.map((p) => (p.detail ? `${p.property.name} (${p.detail})` : p.property.name)),
  };
}

/**
 * A classe sabe usar a arma? Lê "Armas Simples e Marciais" e
 * "Armas Simples e Armas Marciais que possuam a propriedade Acuidade ou Leve".
 */
export function isWeaponProficient(weapon: NonNullable<SrdItem['weapon']>, weaponTraining: string): boolean {
  const lower = normalize(weaponTraining);
  if (weapon.is_simple && lower.includes('simples')) return true;
  const restricted = lower.match(/marciais que (?:possuam|tenham) a propriedade (.+)/);
  if (!weapon.is_simple && restricted) return propertyNames(weapon).some((p) => restricted[1]!.includes(p));
  if (!weapon.is_simple && /marcia/.test(lower)) return true;
  return lower.includes(normalize(weapon.name));
}

/** Atributo de conjuração: CD = 8 + prof + mod; ataque = prof + mod. */
export function spellStats(ability: Ability, scores: AbilityScores, proficiencyBonus: number) {
  const mod = abilityModifier(scores[ability]);
  return { saveDC: 8 + proficiencyBonus + mod, attack: proficiencyBonus + mod };
}

// ---------------------------------------------------------------------------
// Personalidade sugerida

export interface SuggestedCharacteristics {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

/** Os antecedentes da API (Livro do Jogador 2024) não têm tabelas de personalidade: a história fica livre. */
export function suggestedCharacteristics(_bg: SrdBackground): SuggestedCharacteristics {
  return { traits: [], ideals: [], bonds: [], flaws: [] };
}
