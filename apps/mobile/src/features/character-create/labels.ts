import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Ability } from '@dnf/core/character';
import { DiferenteKey } from '@dnf/core/util';

// Rótulos de interface. Os nomes de classes, espécies etc. vêm da Open5e como estão.

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const EDITION_INFO: Record<DiferenteKey.Edition, { title: string; subtitle: string; tagline: string }> = {
  '2014': { title: '2014', subtitle: '5ª edição · SRD 5.1', tagline: 'O clássico: raças com sub-raças e bônus de atributo pela raça.' },
  '2024': { title: '2024', subtitle: 'Edição revisada · SRD 5.2', tagline: 'Regras atualizadas: espécies, antecedentes que dão atributos e talentos.' },
};

const CLASS_ICONS: Record<string, IconName> = {
  barbarian: 'axe-battle',
  bard: 'music',
  cleric: 'cross',
  druid: 'leaf',
  fighter: 'sword',
  monk: 'karate',
  paladin: 'shield-sword',
  ranger: 'bow-arrow',
  rogue: 'knife',
  sorcerer: 'fire',
  warlock: 'eye',
  wizard: 'wizard-hat',
};

export function classIcon(key: string): IconName {
  return CLASS_ICONS[DiferenteKey.parse(key)?.slug ?? ''] ?? 'dice-d20';
}

export const CASTER_LABEL: Record<string, string> = {
  FULL: 'Conjurador completo',
  HALF: 'Meio-conjurador',
  THIRD: 'Um terço de conjurador',
  PACT: 'Magia de pacto',
};

export const ABILITY_LABEL: Record<Ability, { name: string; short: string; english: string; icon: IconName }> = {
  str: { name: 'Força', short: 'FOR', english: 'Strength', icon: 'arm-flex' },
  dex: { name: 'Destreza', short: 'DES', english: 'Dexterity', icon: 'run-fast' },
  con: { name: 'Constituição', short: 'CON', english: 'Constitution', icon: 'heart-pulse' },
  int: { name: 'Inteligência', short: 'INT', english: 'Intelligence', icon: 'brain' },
  wis: { name: 'Sabedoria', short: 'SAB', english: 'Wisdom', icon: 'eye-outline' },
  cha: { name: 'Carisma', short: 'CAR', english: 'Charisma', icon: 'account-star' },
};

const ATTITUDE: Record<string, string> = { lawful: 'Leal', neutral: 'Neutro', chaotic: 'Caótico' };
const MORALITY: Record<string, string> = { good: 'Bom', neutral: 'Neutro', evil: 'Mau' };

/** "Leal e Bom", "Neutro" (verdadeiro), "Caótico e Mau"… */
export function alignmentLabel(attitude: string, morality: string): string {
  if (attitude === 'neutral' && morality === 'neutral') return 'Neutro';
  return `${ATTITUDE[attitude] ?? attitude} e ${MORALITY[morality] ?? morality}`;
}

export const ALIGNMENT_ATTITUDES = ['lawful', 'neutral', 'chaotic'] as const;
export const ALIGNMENT_MORALITIES = ['good', 'neutral', 'evil'] as const;

/** Sigla em português: LB, NB, CB… e "N" para o neutro verdadeiro. */
export function alignmentShort(attitude: string, morality: string): string {
  if (attitude === 'neutral' && morality === 'neutral') return 'N';
  return `${(ATTITUDE[attitude] ?? attitude)[0]}${(MORALITY[morality] ?? morality)[0]}`;
}

const SKILL_PT: Record<string, string> = {
  acrobatics: 'Acrobacia',
  'animal-handling': 'Adestrar Animais',
  arcana: 'Arcanismo',
  athletics: 'Atletismo',
  deception: 'Enganação',
  history: 'História',
  insight: 'Intuição',
  intimidation: 'Intimidação',
  investigation: 'Investigação',
  medicine: 'Medicina',
  nature: 'Natureza',
  perception: 'Percepção',
  performance: 'Atuação',
  persuasion: 'Persuasão',
  religion: 'Religião',
  'sleight-of-hand': 'Prestidigitação',
  stealth: 'Furtividade',
  survival: 'Sobrevivência',
};

/** Nome da perícia em português (as chaves da Open5e não têm prefixo de edição). */
export function skillLabel(key: string, fallback?: string): string {
  return SKILL_PT[key] ?? fallback ?? key;
}

export const abilityShort = (a: Ability) => ABILITY_LABEL[a].short;
export const abilityName = (a: Ability) => ABILITY_LABEL[a].name;

/** Alcance de magia: "120 feet" → "120 pés", "Self" → "Pessoal", "Touch" → "Toque". */
export function rangeLabel(range: string): string {
  return range
    .replace(/\bSelf\b/i, 'Pessoal')
    .replace(/\bTouch\b/i, 'Toque')
    .replace(/\bSight\b/i, 'Visão')
    .replace(/\bUnlimited\b/i, 'Ilimitado')
    .replace(/\bSpecial\b/i, 'Especial')
    .replace(/\bfeet\b|\bfoot\b/gi, 'pés')
    .replace(/\bmiles?\b/gi, (m) => (m.toLowerCase() === 'mile' ? 'milha' : 'milhas'));
}

/** Livro de origem de uma subclasse para exibir ao lado do nome ("TOH", "regras de 2014"…). */
export function subclassOrigin(sub: { key: string; adaptedFrom?: string }): string {
  const prefix = sub.key.split('_')[0] ?? '';
  const book = prefix === 'srd' || prefix === 'srd-2024' ? '' : prefix.toUpperCase();
  return [book, sub.adaptedFrom ? `regras de ${sub.adaptedFrom}` : ''].filter(Boolean).join(' · ');
}
