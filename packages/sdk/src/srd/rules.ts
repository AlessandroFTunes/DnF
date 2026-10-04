import { ABILITIES, abilityModifier, type Ability, type AbilityScores } from '@dnf/core/character';
import type {
  SrdArmorData,
  SrdBackground,
  SrdClassDetail,
  SrdClassFeature,
  SrdItem,
  SrdSpecies,
} from './catalog';

/**
 * Regras de criação e da ficha lidas dos dados da Open5e.
 * A Open5e entrega boa parte das regras como texto (tabelas em markdown, listas "Choose two from…");
 * aqui esse texto vira estrutura. Nada é inventado: se o texto não for reconhecido, a escolha fica livre.
 */

// ---------------------------------------------------------------------------
// Básico

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

export function abilityFromName(name: string): Ability | undefined {
  return ABILITY_BY_NAME[name.trim().toLowerCase()];
}

/** Atributos citados num texto, na ordem em que aparecem. */
export function abilitiesIn(text: string): Ability[] {
  const found = [...text.matchAll(/strength|dexterity|constitution|intelligence|wisdom|charisma/gi)];
  return [...new Set(found.map((m) => ABILITY_BY_NAME[m[0].toLowerCase()]!))];
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
  twenty: 20,
};

function toNumber(word: string | undefined): number | undefined {
  if (!word) return undefined;
  const n = Number(word);
  return Number.isFinite(n) ? n : NUMBER_WORDS[word.toLowerCase()];
}

/** "A, B, and C" / "A or B" → ["A", "B", "C"]. */
export function splitList(text: string): string[] {
  return text
    .replace(/\.$/, '')
    .split(/,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const clean = (text = '') => text.replace(/[*_]/g, '').replace(/[’‘]/g, "'").trim();

/** Remove a marcação (negrito, itálico, títulos) para mostrar como texto corrido. */
export function plainText(text = ''): string {
  return text
    // Tabelas markdown: tira a linha separadora e transforma "| 1st | fog cloud |" em "1st: fog cloud".
    .replace(/^[ \t]*\|?[ \t]*:?[-—–]{2,}.*$/gm, '')
    .replace(/^[ \t]*\|[ \t]*$/gm, '')
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, row: string) => {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      return cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(' · ')}` : (cells[0] ?? '');
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*|__|[*_]/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[’‘]/g, "'")
    .trim();
}

// ---------------------------------------------------------------------------
// Perícias

export interface SkillInfo {
  key: string;
  name: string;
  ability: Ability;
}

/** Monta a lista de perícias a partir dos atributos da Open5e (`/v2/abilities/`). */
export function skillsFromAbilities(abilities: { key: string; skills: { key: string; name: string }[] }[]): SkillInfo[] {
  return abilities
    .flatMap((a) => a.skills.map((s) => ({ key: s.key, name: s.name, ability: a.key as Ability })))
    .filter((s) => ABILITIES.includes(s.ability))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Nomes de perícias citados num texto → chaves. */
export function skillKeysIn(text: string, skills: SkillInfo[]): string[] {
  const lower = clean(text).toLowerCase();
  return skills.filter((s) => lower.includes(s.name.toLowerCase())).map((s) => s.key);
}

export interface SkillChoice {
  count: number;
  /** null = qualquer perícia. */
  options: string[] | null;
}

// ---------------------------------------------------------------------------
// Tabelas da classe

/** Valor de uma coluna da tabela da classe num nível (as linhas podem pular níveis: vale a última anterior). */
export function tableValue(features: SrdClassFeature[], names: string[], level: number): string | undefined {
  const feature = features.find(
    (f) => (f.feature_type === 'CLASS_TABLE_DATA' || f.feature_type === 'SPELL_SLOTS') && names.includes(f.name),
  );
  const rows = (feature?.data_for_class_table ?? []).filter((r) => r.level <= level).sort((a, b) => b.level - a.level);
  return rows[0]?.column_value;
}

const tableNumber = (features: SrdClassFeature[], names: string[], level: number) => {
  const value = tableValue(features, names, level);
  const n = value ? parseInt(value.replace(/[^\d-]/g, ''), 10) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const SLOT_COLUMNS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'] as const;

/** Espaços de magia por nível de magia ("1"…"9") no nível de personagem dado. */
export function spellSlots(cls: SrdClassDetail, level: number): Partial<Record<string, number>> {
  const slots: Partial<Record<string, number>> = {};
  SLOT_COLUMNS.forEach((column, i) => {
    const n = tableNumber(cls.features, [column], level);
    if (n > 0) slots[String(i + 1)] = n;
  });
  // Bruxo (magia de pacto): todos os espaços no mesmo nível.
  const pact = tableNumber(cls.features, ['Spell Slots'], level);
  if (pact > 0) {
    const slotLevel = parseInt(tableValue(cls.features, ['Slot Level'], level) ?? '1', 10) || 1;
    slots[String(slotLevel)] = pact;
  }
  return slots;
}

/** Features da classe ganhas até o nível (sem as entradas de tabela). */
export function classFeaturesUpTo(cls: SrdClassDetail, level: number): SrdClassFeature[] {
  return cls.features
    .filter((f) => f.feature_type === 'CLASS_LEVEL_FEATURE')
    .filter((f) => (f.gained_at ?? []).some((g) => g.level <= level))
    .sort((a, b) => minLevel(a) - minLevel(b) || a.name.localeCompare(b.name));
}

const minLevel = (f: SrdClassFeature) => Math.min(...(f.gained_at ?? []).map((g) => g.level), 99);

/** Feature da classe base que concede a subclasse (2014: nomes próprios; 2024: "<Classe> Subclass"). */
const SUBCLASS_FEATURES = new Set([
  'primal path',
  'bard college',
  'divine domain',
  'druid circle',
  'martial archetype',
  'monastic tradition',
  'sacred oath',
  'ranger archetype',
  'roguish archetype',
  'sorcerous origin',
  'otherworldly patron',
  'arcane tradition',
]);

/**
 * Nível em que se escolhe a subclasse. Vem da feature da classe que concede a subclasse
 * (Clérigo 2014: 1; Mago 2014: 2; tudo em 2024: 3). Sem ela, o menor nível das subclasses.
 */
export function subclassLevel(subclasses: SrdClassDetail[], cls: SrdClassDetail): number {
  const granting = cls.features.find(
    (f) => f.feature_type === 'CLASS_LEVEL_FEATURE' && (SUBCLASS_FEATURES.has(f.name.toLowerCase()) || /subclass(es)?$/i.test(f.name)),
  );
  if (granting && (granting.gained_at ?? []).length) return minLevel(granting);
  const levels = subclasses.flatMap((s) => s.features.flatMap((f) => (f.gained_at ?? []).map((g) => g.level)));
  return levels.length ? Math.min(...levels) : 3;
}

/** Níveis com Aumento no Valor de Atributo (ou talento). */
export function asiLevels(cls: SrdClassDetail): number[] {
  const feature = cls.features.find((f) => f.name === 'Ability Score Improvement');
  return [...new Set((feature?.gained_at ?? []).map((g) => g.level))].sort((a, b) => a - b);
}

/** Features da classe por nível (sem as entradas de tabela), para a árvore de evolução. */
export function featuresByLevel(cls: SrdClassDetail): Map<number, SrdClassFeature[]> {
  const map = new Map<number, SrdClassFeature[]>();
  for (const f of cls.features) {
    if (f.feature_type !== 'CLASS_LEVEL_FEATURE' || f.name === 'Ability Score Improvement') continue;
    for (const g of f.gained_at ?? []) map.set(g.level, [...(map.get(g.level) ?? []), f]);
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
  /** Defesa sem armadura: atributo somado à Destreza (Bárbaro: con, Monge: wis). */
  unarmoredDefense: Ability | null;
}

export function classRules(cls: SrdClassDetail, skills: SkillInfo[]): ClassRules {
  const core = coreTraits(cls.features);
  const proficiencies = cls.features.find((f) => f.feature_type === 'PROFICIENCIES')?.desc ?? '';
  const field = (label2014: string, label2024: string) =>
    core[label2024.toLowerCase()] ?? proficiencyLine(proficiencies, label2014) ?? '';

  const skillText = field('Skills', 'Skill Proficiencies');
  const armorTraining = field('Armor', 'Armor Training');

  // O texto (tabela 2024 / proficiências 2014) é mais confiável que o array `saving_throws` da API.
  const savingThrows = abilitiesIn(field('Saving Throws', 'Saving Throw Proficiencies'));

  const unarmored = cls.features.find((f) => f.name === 'Unarmored Defense' && minLevel(f) <= 1);

  return {
    hitDie: parseInt((cls.hit_dice ?? 'd8').replace(/\D/g, ''), 10) || 8,
    savingThrows: savingThrows.length
      ? savingThrows
      : cls.saving_throws.map((s) => abilityFromName(s.name)).filter((a): a is Ability => !!a),
    skillChoice: parseSkillChoice(skillText, skills),
    armorTraining,
    weaponTraining: field('Weapons', 'Weapon Proficiencies'),
    toolTraining: field('Tools', 'Tool Proficiencies'),
    armorProficiencies: parseArmorTraining(armorTraining),
    equipment: parseClassEquipment(cls.features, core['starting equipment']),
    spellcasting: spellcastingRules(cls),
    expertiseAtLevel1: cls.features.some((f) => f.name === 'Expertise' && minLevel(f) === 1) ? 2 : 0,
    unarmoredDefense: unarmored
      ? (abilitiesIn(unarmored.desc ?? '').find((a) => a === 'con' || a === 'wis') ?? null)
      : null,
  };
}

/** 2024: tabela "Core X Traits" em markdown → { "skill proficiencies": "Choose 2: …" }. */
function coreTraits(features: SrdClassFeature[]): Record<string, string> {
  const table = features.find((f) => f.feature_type === 'CORE_TRAITS_TABLE')?.desc ?? '';
  const rows: Record<string, string> = {};
  for (const line of table.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length >= 3 && cells[1] && cells[2] && !cells[1].startsWith('-')) rows[cells[1].toLowerCase()] = cells[2];
  }
  return rows;
}

/** 2014: "**Skills:** Choose two from …" dentro da feature de proficiências. */
function proficiencyLine(text: string, label: string): string | undefined {
  const match = text.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, 'i'));
  return match?.[1]?.trim();
}

export function parseSkillChoice(text: string, skills: SkillInfo[]): SkillChoice {
  const plain = clean(text);
  const count = toNumber(plain.match(/choose\s+(?:any\s+)?(\w+)/i)?.[1]) ?? 2;
  if (/choose\s+any/i.test(plain)) return { count, options: null };
  const options = skillKeysIn(plain, skills);
  return { count, options: options.length ? options : null };
}

function parseArmorTraining(text: string): ClassRules['armorProficiencies'] {
  const lower = text.toLowerCase();
  const set: ClassRules['armorProficiencies'] = new Set();
  if (lower.includes('all armor')) ['light', 'medium', 'heavy'].forEach((c) => set.add(c as 'light'));
  for (const category of ['light', 'medium', 'heavy'] as const) if (lower.includes(category)) set.add(category);
  if (lower.includes('shield')) set.add('shield');
  return set;
}

// ---------------------------------------------------------------------------
// Conjuração

export interface SpellcastingRules {
  ability: Ability;
  /** Truques no 1º nível. */
  cantrips: number;
  /** Magias de 1º círculo no 1º nível; `null` = atributo + nível (conjurador preparado de 2014). */
  spells: number | null;
  /** Espaços de 1º círculo no 1º nível. */
  slots: number;
  /** Prepara magias da lista (2014: clérigo, druida, mago) em vez de conhecê-las. */
  preparesFromList: boolean;
}

/** Atributo de conjuração da classe (mesmo que ela só conjure em níveis mais altos). */
export function spellcastingAbility(cls: SrdClassDetail): Ability | null {
  const casting = cls.features.find((f) => f.name === 'Spellcasting' || f.name === 'Pact Magic');
  const desc = casting?.desc ?? '';
  return (
    abilitiesIn(desc.match(/(\w+) is your spellcasting ability/i)?.[0] ?? '')[0] ??
    abilitiesIn(desc.match(/spellcasting ability[^.]*/i)?.[0] ?? '')[0] ??
    abilitiesIn(desc).find((a) => a === 'int' || a === 'wis' || a === 'cha') ??
    null
  );
}

export function spellcastingRules(cls: SrdClassDetail): SpellcastingRules | null {
  const casting = cls.features.find((f) => f.name === 'Spellcasting' || f.name === 'Pact Magic');
  if (!casting) return null;
  const desc = casting.desc ?? '';
  const ability = spellcastingAbility(cls);
  if (!ability) return null;

  const cantrips = tableNumber(cls.features, ['Cantrips', 'Cantrips Known'], 1);
  const known = tableNumber(cls.features, ['Prepared Spells', 'Spells Known'], 1);
  const slots = tableNumber(cls.features, ['1st', 'Spell Slots'], 1);
  // Grimório do mago de 2014: "a spellbook containing six 1st-level wizard spells".
  const spellbook = toNumber(desc.match(/spellbook containing (\w+)/i)?.[1]);
  // Bardo/feiticeiro de 2014: "You know four 1st-level spells" (sem coluna na tabela).
  const knownText = toNumber(desc.match(/you know (\w+) 1st-level spells/i)?.[1]);

  const spells = known > 0 ? known : slots > 0 ? (spellbook ?? knownText ?? null) : 0;
  if (cantrips === 0 && spells === 0) return null; // ex.: paladino/patrulheiro de 2014 só conjuram no 2º nível
  return { ability, cantrips, spells, slots, preparesFromList: known === 0 && slots > 0 && !spellbook && !knownText };
}

/** Quantas magias de 1º círculo escolher, já resolvendo "atributo + nível". */
export function spellsToChoose(rules: SpellcastingRules, scores: AbilityScores, level = 1): number {
  return rules.spells ?? Math.max(1, abilityModifier(scores[rules.ability]) + level);
}

// ---------------------------------------------------------------------------
// Equipamento

export interface ItemRef {
  /** Texto original (ex.: "2 Daggers"). */
  text: string;
  name: string;
  quantity: number;
  /** Arma genérica a escolher ("a martial weapon"). */
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

function parseClassEquipment(features: SrdClassFeature[], core2024?: string): EquipmentChoice[] {
  if (core2024) return [parseLetteredOptions(core2024)];
  const desc = features.find((f) => f.feature_type === 'STARTING_EQUIPMENT')?.desc ?? '';
  return desc
    .split('\n')
    .filter((line) => line.trim().startsWith('*'))
    .map((line) => {
      const body = line.replace(/^\s*\*\s*/, '');
      const parts = body.split(/\(\*?([a-z])\*?\)/i).slice(1);
      if (parts.length === 0) return { options: [option('a', body)] };
      const options: EquipmentOption[] = [];
      for (let i = 0; i < parts.length; i += 2) {
        const text = (parts[i + 1] ?? '').replace(/,?\s*(\bor)?\s*$/i, '').trim();
        options.push(option(parts[i]!.toLowerCase(), text));
      }
      return { options };
    });
}

/** "Choose A or B: (A) …; or (B) 50 GP" → opções A/B. Sem letras: uma opção fixa. */
export function parseLetteredOptions(text: string): EquipmentChoice {
  const body = clean(text).replace(/^choose[^:]*:\s*/i, '');
  const parts = body.split(/\(([A-Z])\)/).slice(1);
  if (parts.length === 0) return { options: [option('A', body)] };
  const options: EquipmentOption[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = (parts[i + 1] ?? '').replace(/[;,]?\s*(\bor)?\s*$/i, '').trim();
    options.push(option(parts[i]!, text));
  }
  return { options };
}

function option(id: string, text: string): EquipmentOption {
  const label = clean(text);
  let gp = 0;
  const items: ItemRef[] = [];
  for (const raw of splitList(label)) {
    // "15 GP", "a belt pouch containing 10 gp", "pouch with 10 gp", "10g"
    const gold = raw.match(/^(?:(?:a\s+)?(?:belt\s+)?(?:pouch|purse)\s+(?:containing|with)\s+)?(\d+)\s*g(?:p|old)?$/i);
    if (gold) {
      gp += Number(gold[1]);
      continue;
    }
    // "quiver of 20 arrows" → aljava + 20 flechas
    const of = raw.match(/^(?:a|an)?\s*(quiver|case)\s+of\s+(.+)$/i);
    const pieces = of ? [of[1]!, of[2]!] : [raw];
    for (const piece of pieces) items.push(itemRef(piece));
  }
  return { id, label, items, gp };
}

function itemRef(text: string): ItemRef {
  const match = text.match(/^(\w+)\s+(.*)$/);
  const quantity = toNumber(match?.[1]);
  const name = (quantity !== undefined ? match![2]! : text).replace(/^(set of|sticks? of|flasks? of)\s+/i, '').trim();
  const weapon = text.match(/\b(simple|martial)\b.*\bweapons?\b/i);
  return { text, name, quantity: quantity ?? 1, pick: weapon ? (weapon[1]!.toLowerCase() as 'simple' | 'martial') : undefined };
}

const normalize = (s: string) =>
  clean(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^(a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "Crossbow, light" → "light crossbow"; "Clothes, Common" → "common clothes". */
const itemNames = (item: SrdItem) => {
  const base = normalize(item.name);
  const comma = base.split(',').map((s) => s.trim());
  return comma.length === 2 ? [base, `${comma[1]} ${comma[0]}`, comma[0]!] : [base];
};

/** Formas singulares possíveis ("handaxes" → handaxe; "pouches" → pouch; "daggers" → dagger). */
const singulars = (s: string) => [s.replace(/ies$/, 'y'), s.replace(/es$/, ''), s.replace(/s$/, '')];
const singular = (s: string) => s.replace(/s$/, '');

/** Acha o item do SRD pelo nome escrito no texto do equipamento. */
export function findItem(name: string, items: SrdItem[]): SrdItem | undefined {
  // "Gaming Set (same as above)", "Musical Instrument of your choice": a escolha é do jogador, não chuta um item.
  if (/same as above|of your choice|\(any\)|chosen for/i.test(name)) return undefined;
  const wanted = normalize(name);
  const compact = (s: string) => s.replace(/\s+/g, '');
  // O texto da Open5e tem erros de digitação com espaço ("Ar rows"): compara também sem espaços.
  const variants = [wanted, ...singulars(wanted)].flatMap((v) => [v, compact(v)]);
  for (const v of variants) {
    const hit = items.find((i) => itemNames(i).some((n) => n === v || compact(n) === v));
    if (hit) return hit;
  }
  // "a wooden shield" (druida de 2014) é o Escudo comum.
  if (/\bshield$/.test(wanted)) return items.find((i) => normalize(i.name) === 'shield');
  // Último recurso: o item cujo nome tem todas as palavras (o mais curto ganha).
  const words = singular(wanted).split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return undefined;
  return items
    .filter((i) => {
      const itemWords = itemNames(i)[0]!.split(/[ ,]+/).map(singular);
      return words.every((w) => itemWords.includes(w));
    })
    .sort((a, b) => a.name.length - b.name.length)[0];
}

/** Quantidade em unidades do item: "20 Arrows" com o item "Arrows (20)" é 1 pacote. */
export function itemQuantity(ref: ItemRef, item: SrdItem): number {
  const bundle = Number(item.name.match(/\((\d+)\)/)?.[1]);
  return bundle && ref.quantity % bundle === 0 ? ref.quantity / bundle : ref.quantity;
}

export const isShield = (item: Pick<SrdItem, 'name' | 'category' | 'armor'>) =>
  item.category?.key === 'shield' || !!item.armor?.key.endsWith('shield') || item.name.toLowerCase() === 'shield';

export const isBodyArmor = (item: Pick<SrdItem, 'armor' | 'name' | 'category'>) => !!item.armor && !isShield(item);

// ---------------------------------------------------------------------------
// Espécie

export interface SpeciesRules {
  speed: number;
  size: string;
  /** Bônus fixos de atributo (2014). */
  abilityBonuses: Partial<Record<Ability, number>>;
  /** "+1 em dois outros à sua escolha" (Meio-elfo de 2014). */
  abilityChoice: { count: number; amount: number } | null;
  skills: string[];
  skillChoice: SkillChoice | null;
  languages: string[];
  extraLanguages: number;
  /** PV extra por nível (Robustez Anã). */
  hpPerLevel: number;
  /** Talento de origem à escolha (Humano de 2024). */
  originFeat: boolean;
  traits: { name: string; desc: string }[];
}

/** Junta espécie base e subespécie (as duas listas de traços valem). */
export function speciesRules(chain: SrdSpecies[], skills: SkillInfo[], languageNames: string[]): SpeciesRules {
  const traits = chain.flatMap((s) => s.traits);
  const rules: SpeciesRules = {
    speed: 30,
    size: 'Medium',
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

  for (const trait of traits) {
    const desc = clean(trait.desc);
    const name = trait.name.toLowerCase();
    if (trait.type === 'SPEED' || name === 'speed') {
      rules.speed = Number(desc.match(/(\d+)\s*feet/)?.[1] ?? rules.speed);
      continue;
    }
    if (trait.type === 'SIZE' || name === 'size') {
      rules.size = desc.match(/\b(Small|Medium)\b/)?.[1] ?? rules.size;
      continue;
    }
    if (trait.type === 'ABILITY_MODS' || name === 'ability score increase') {
      if (/each increase by (\d)/i.test(desc)) {
        const n = Number(desc.match(/each increase by (\d)/i)![1]);
        ABILITIES.forEach((a) => (rules.abilityBonuses[a] = (rules.abilityBonuses[a] ?? 0) + n));
      }
      for (const m of desc.matchAll(/(\w+) score increases by (\d)/gi)) {
        const ability = abilityFromName(m[1]!);
        if (ability) rules.abilityBonuses[ability] = (rules.abilityBonuses[ability] ?? 0) + Number(m[2]);
      }
      const choice = desc.match(/(\w+) other ability scores of your choice increase by (\d)/i);
      if (choice) rules.abilityChoice = { count: toNumber(choice[1]) ?? 2, amount: Number(choice[2]) };
      continue;
    }
    if (name === 'languages') {
      const first = desc.split(/\.\s/)[0] ?? desc; // o resto do texto cita idiomas como exemplo
      rules.languages = languageNames.filter((l) => first.includes(l));
      rules.extraLanguages = toNumber(desc.match(/(\w+) extra language/i)?.[1]) ?? 0;
      continue;
    }
    if (/hit point maximum increases by 1/i.test(desc)) rules.hpPerLevel += 1;
    if (/origin feat of your choice/i.test(desc)) rules.originFeat = true;

    const grant = parseSkillGrant(desc, skills);
    if (grant.fixed.length) rules.skills.push(...grant.fixed);
    if (grant.choice) rules.skillChoice = grant.choice;

    if (!['age', 'alignment'].includes(name)) rules.traits.push({ name: trait.name, desc: plainText(trait.desc) });
  }
  return rules;
}

/** "proficiency in the Perception skill" (fixa) / "Insight, Perception, or Survival skill" / "one skill of your choice". */
function parseSkillGrant(desc: string, skills: SkillInfo[]): { fixed: string[]; choice: SkillChoice | null } {
  if (!/proficiency/i.test(desc) || !/skill/i.test(desc)) return { fixed: [], choice: null };
  const anyChoice = desc.match(/proficiency in (\w+) skills? of your choice/i);
  if (anyChoice) return { fixed: [], choice: { count: toNumber(anyChoice[1]) ?? 1, options: null } };
  const sentence = desc.match(/proficiency in ([^.]*?)skill/i)?.[1] ?? '';
  const keys = skillKeysIn(sentence, skills);
  if (keys.length > 1 && /\bor\b/i.test(sentence)) return { fixed: [], choice: { count: 1, options: keys } };
  return { fixed: keys, choice: null };
}

// ---------------------------------------------------------------------------
// Antecedente

export interface BackgroundRules {
  skills: string[];
  /** Livros fora do SRD: "either Animal Handling or Nature", "your choice of two from…". */
  skillChoice: SkillChoice | null;
  /** 2024: os três atributos que o antecedente pode aumentar. */
  abilityOptions: Ability[];
  /** 2024: talento de origem ("Magic Initiate (Wizard)" → nome + lista de magias). */
  feat: { name: string; spellList: string | null } | null;
  tools: string;
  languagesToChoose: number;
  equipment: EquipmentChoice | null;
}

export function backgroundRules(bg: SrdBackground, skills: SkillInfo[]): BackgroundRules {
  const benefit = (type: string) => bg.benefits.find((b) => b.type === type)?.desc ?? '';
  const featText = clean(benefit('feat'));
  const featMatch = featText.match(/^([^(]+?)\s*(?:\(([^)]+)\))?$/);
  const equipment = benefit('equipment');
  const skillGrant = parseBackgroundSkills(benefit('skill_proficiency'), skills);
  // Antecedentes do Level Up (A5E) também dão atributo, mas nas regras de 2014 o bônus vem da raça.
  const usesAbilityScores = !(bg.document.key ?? '').startsWith('a5e');
  return {
    skills: skillGrant.fixed,
    skillChoice: skillGrant.choice,
    abilityOptions: usesAbilityScores ? abilitiesIn(benefit('ability_score')) : [],
    feat: featText ? { name: featMatch?.[1]?.trim() ?? featText, spellList: featMatch?.[2]?.trim() ?? null } : null,
    tools: clean(benefit('tool_proficiency')),
    languagesToChoose: toNumber(clean(benefit('language')).match(/^(\w+)/)?.[1]) ?? 0,
    equipment: equipment ? parseLetteredOptions(equipment) : null,
  };
}

/** Perícias de antecedente: fixas e/ou à escolha. */
function parseBackgroundSkills(text: string, skills: SkillInfo[]): { fixed: string[]; choice: SkillChoice | null } {
  const plain = clean(text);
  // "Your choice of two from among Arcana, History, and Persuasion."
  const among = plain.match(/choice of (\w+) from(?: among)? (.+)/i);
  if (among) {
    // Pode vir com perícias fixas antes: "Insight. Your choice of 2 from among …".
    const fixed = skillKeysIn(plain.slice(0, among.index), skills);
    return { fixed, choice: { count: toNumber(among[1]) ?? 1, options: skillKeysIn(among[2]!, skills) } };
  }
  // "Two of your choice" / "one skill of your choice"
  const any = plain.match(/^(\w+)(?: skills?)? of your choice/i);
  if (any) return { fixed: [], choice: { count: toNumber(any[1]) ?? 1, options: null } };
  // "Survival, and either Animal Handling or Nature."
  const either = plain.match(/either (.+?) or ([^,.]+)/i);
  if (either) {
    const options = skillKeysIn(`${either[1]} ${either[2]}`, skills);
    const fixed = skillKeysIn(plain.replace(either[0], ''), skills);
    return { fixed, choice: options.length ? { count: 1, options } : null };
  }
  return { fixed: skillKeysIn(plain, skills), choice: null };
}

/** PV extras por nível vindos de talentos (ex.: Tough/Robusto: "twice your character level"). */
export function featHitPointsPerLevel(feats: { benefits?: { desc?: string }[]; desc?: string }[]): number {
  return feats.reduce((sum, f) => {
    const text = [f.desc, ...(f.benefits ?? []).map((b) => b.desc)].join(' ');
    return sum + (/twice your (character )?level/i.test(text) ? 2 : 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Atributos

/** Custo de compra por pontos (27 pontos, valores de 8 a 15). */
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;

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

/** Dano/ataque de uma arma: Acuidade usa o melhor entre FOR e DES; à distância usa DES. */
export function weaponAttack(weapon: SrdItem['weapon'], scores: AbilityScores, proficiencyBonus: number, proficient: boolean) {
  if (!weapon) return null;
  const props = weapon.properties.map((p) => p.property.name.toLowerCase());
  const ranged = props.includes('ammunition') || (weapon.range != null && !props.includes('thrown') && weapon.range > 5);
  const str = abilityModifier(scores.str);
  const dex = abilityModifier(scores.dex);
  const mod = props.includes('finesse') ? Math.max(str, dex) : ranged ? dex : str;
  return {
    toHit: mod + (proficient ? proficiencyBonus : 0),
    damage: `${weapon.damage_dice}${mod === 0 ? '' : mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`}`,
    damageType: weapon.damage_type.name,
    properties: weapon.properties.map((p) => (p.detail ? `${p.property.name} (${p.detail})` : p.property.name)),
  };
}

/** A classe sabe usar a arma? Lê "Simple weapons, martial weapons" / "Simple and Martial weapons" / nomes. */
export function isWeaponProficient(weapon: NonNullable<SrdItem['weapon']>, weaponTraining: string): boolean {
  const lower = weaponTraining.toLowerCase();
  if (weapon.is_simple && lower.includes('simple')) return true;
  if (!weapon.is_simple && /martial/.test(lower) && !/martial weapons that have/.test(lower)) return true;
  if (!weapon.is_simple && /martial weapons that have/.test(lower)) {
    const props = weapon.properties.map((p) => p.property.name.toLowerCase());
    return props.includes('finesse') || props.includes('light');
  }
  return lower.includes(weapon.name.toLowerCase()) || lower.includes(singular(weapon.name.toLowerCase()));
}

/** Atributo de conjuração: CD = 8 + prof + mod; ataque = prof + mod. */
export function spellStats(ability: Ability, scores: AbilityScores, proficiencyBonus: number) {
  const mod = abilityModifier(scores[ability]);
  return { saveDC: 8 + proficiencyBonus + mod, attack: proficiencyBonus + mod };
}


// ---------------------------------------------------------------------------
// Personalidade sugerida (tabelas d8/d6 dos antecedentes de 2014)

export interface SuggestedCharacteristics {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

/** Lê as tabelas "| d8 | Personality Trait |" do antecedente. */
export function suggestedCharacteristics(bg: SrdBackground): SuggestedCharacteristics {
  const text = bg.benefits.find((b) => b.type === 'suggested_characteristics')?.desc ?? '';
  const result: SuggestedCharacteristics = { traits: [], ideals: [], bonds: [], flaws: [] };
  let current: keyof SuggestedCharacteristics | null = null;
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const header = cells[1]!.toLowerCase();
    if (/^d\d+$/i.test(cells[0]!)) {
      current = header.startsWith('personality')
        ? 'traits'
        : header.startsWith('ideal')
          ? 'ideals'
          : header.startsWith('bond')
            ? 'bonds'
            : header.startsWith('flaw')
              ? 'flaws'
              : null;
      continue;
    }
    if (current && /^\d+$/.test(cells[0]!)) result[current].push(plainText(cells[1]!));
  }
  return result;
}
