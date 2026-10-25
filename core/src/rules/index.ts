import type { DiferenteKey } from '../util';

/**
 * Port de regras: o contrato que o app espera de qualquer fonte de regras de D&D (classes, espécies,
 * antecedentes, talentos, itens, magias). Cada API é um adapter que o implementa (a 5e-FastAPI está em
 * `@dnf/sdk/srd`); o app só conhece estes tipos.
 *
 * `Raw` é o registro original da API, que alguns cálculos de `@dnf/sdk` ainda leem (ver `api` nos tipos).
 * Um adapter que não tem esse registro devolve `unknown`.
 */
export namespace Rules {
  export type Edition = DiferenteKey.Edition;

  /** Registros originais da API que acompanham os tipos do app. */
  export interface RawShapes {
    class?: unknown;
    casting?: unknown;
    background?: unknown;
  }
  export type Raw<R extends RawShapes, K extends keyof RawShapes> = R[K];

  export interface Source {
    key: string;
    name: string;
    edition: Edition | null;
  }

  /** Característica de classe/subclasse com o nível em que é ganha. */
  export interface ClassFeature {
    key: string;
    name: string;
    desc: string;
    gained_at: { level: number; detail: string | null }[];
  }

  export interface ClassDetail<R extends RawShapes = RawShapes> {
    key: string;
    name: string;
    desc: string;
    source: Source;
    /** "d12", como a ficha mostra. */
    hit_dice: string;
    features: ClassFeature[];
    /** Como entra na conta dos espaços de magia de multiclasse; null se não conjura (subclasses: Cavaleiro Místico…). */
    casting: Raw<R, 'casting'> | null;
    /** Registro da classe na API (ausente nas subclasses). */
    api?: Raw<R, 'class'>;
    /** Subclasse feita para a outra edição (a API ainda não mistura edições; fica para o futuro). */
    adaptedFrom?: Edition;
  }

  export type Class<R extends RawShapes = RawShapes> = ClassDetail<R>;

  export interface SpeciesTrait {
    name: string;
    desc: string;
    type?: 'SIZE' | 'SPEED';
    order: number;
  }

  export interface Species {
    key: string;
    name: string;
    desc: string;
    source: Source;
    is_subspecies: boolean;
    subspecies_of: string | null;
    traits: SpeciesTrait[];
  }

  /** Espécie base com as subespécies dela (a API de 2024 não tem subespécies). */
  export interface SpeciesGroup extends Species {
    subspecies: Species[];
  }

  export interface Background<R extends RawShapes = RawShapes> {
    key: string;
    name: string;
    desc: string;
    /** Livro de origem (para agrupar a lista). */
    document: { key: string; name: string };
    /** Benefícios em texto, para exibir (`type`: ability_score, feat, skill_proficiency, tool_proficiency, equipment). */
    benefits: { name: string; desc: string; type: string }[];
    api: Raw<R, 'background'>;
  }

  export interface Feat {
    key: string;
    name: string;
    desc: string;
    /** Categoria do talento ("Origem", "Geral"…). */
    type: string | null;
    prerequisite: string | null;
    benefits: { name: string; desc: string }[];
  }

  export interface ArmorData {
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

  export interface WeaponData {
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

  export type ItemKind = 'arma' | 'armadura' | 'ferramenta' | 'item';

  export interface Item {
    key: string;
    name: string;
    kind: ItemKind;
    desc?: string;
    category: { name: string; key: string };
    weapon: WeaponData | null;
    armor: ArmorData | null;
    cost?: string | null;
    weight?: string;
    /** Ferramenta com variantes ("Instrumento Musical": Alaúde, Flauta…): a proficiência é numa delas. */
    variants?: string[];
  }

  export interface Spell {
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

  /** Linha da tabela "Conjurador Multiclasse": espaços por círculo (do 1º ao 9º) no nível de conjurador. */
  export interface MulticlassSlots {
    casterLevel: number;
    slots: number[];
  }


  export interface Language {
    key: string;
    name: string;
    is_exotic: boolean;
    is_secret: boolean;
  }

  export interface Alignment {
    key: string;
    societal_attitude: 'lawful' | 'neutral' | 'chaotic';
    morality: 'good' | 'neutral' | 'evil';
  }

  /** Traço, ação, reação… do bloco de estatísticas. */
  export interface CreatureAbility {
    name: string;
    desc: string;
  }

  /** Bloco de estatísticas de uma criatura. Os valores vêm como no livro (texto), para exibir ao mestre. */
  export interface Creature {
    key: string;
    name: string;
    source: Source;
    /** Tipo e tamanho ("Fera Grande"). */
    type: string;
    alignment: string;
    armor_class: string;
    initiative: string | null;
    hit_points: string;
    speed: string;
    abilities: { ability: string; score: number; modifier: number; save: number | null }[];
    saves: string | null;
    skills: string | null;
    resistances: string | null;
    vulnerabilities: string | null;
    damage_immunities: string | null;
    condition_immunities: string | null;
    gear: string | null;
    senses: string;
    languages: string;
    /** "1/4 (XP 50; BP +2)". */
    challenge: string;
    proficiency_bonus: string | null;
    traits: CreatureAbility[];
    actions: CreatureAbility[];
    bonus_actions: CreatureAbility[];
    reactions: CreatureAbility[];
    legendary_desc: string | null;
    legendary_actions: CreatureAbility[];
  }

  /** Regras do mestre: criaturas. Uma fonte pode implementar só isto (ex.: Open5e no DM-Control). */
  export interface CreaturePort {
    /** Criaturas da edição. `name` filtra por trecho do nome. */
    creatures(edition: Edition, filter?: { name?: string }): Promise<Creature[]>;
    creaturesByKey(keys: string[]): Promise<Creature[]>;
  }

  /**
   * Consultas de regras por edição (2014 ou 2024). Só traz dados de regra; o que o jogador escolheu fica
   * no PocketBase. Chaves são texto estável (é o que fica guardado no personagem).
   */
  export interface Port<R extends RawShapes = RawShapes> extends CreaturePort {
    /** Livros cadastrados na fonte. */
    sources(): Promise<Source[]>;
    classes(edition: Edition): Promise<Class<R>[]>;
    /** Classe completa: características, progressão, equipamento e proficiências. */
    classDetail(key: string): Promise<ClassDetail<R>>;
    subclasses(classKey: string): Promise<ClassDetail<R>[]>;
    /** Tabela de espaços de magia do conjurador multiclasse da edição. */
    multiclassSlots(edition: Edition): Promise<MulticlassSlots[]>;
    species(edition: Edition): Promise<SpeciesGroup[]>;
    backgrounds(edition: Edition): Promise<Background<R>[]>;
    feats(edition: Edition): Promise<Feat[]>;
    /** Armas, armaduras, ferramentas e equipamento de aventura da edição. */
    items(edition: Edition): Promise<Item[]>;
    /** Itens por chave ("arma:3", "armadura:1"…), para montar a ficha. */
    itemsByKey(keys: string[]): Promise<Item[]>;
    /** Magias da lista de uma classe até o círculo `maxLevel` (0 = truques). */
    spells(classKey: string, maxLevel: number, edition?: Edition): Promise<Spell[]>;
    spellsByKey(keys: string[]): Promise<Spell[]>;
    alignments(): Promise<Alignment[]>;
    languages(): Promise<Language[]>;
  }
}
