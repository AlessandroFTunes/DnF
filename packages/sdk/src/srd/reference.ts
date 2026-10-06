import type { Ability } from '@dnf/core/character';
import type { DiferenteKey } from '@dnf/core/util';

export type SrdEdition = DiferenteKey.Edition;

/** Cada fonte (livro) da API diz a edição dela: "5e" (regras de 2014) ou "5.5e" (regras de 2024). */
export const SRD_EDITIONS = {
  '2014': '5e',
  '2024': '5.5e',
} as const satisfies Record<SrdEdition, string>;

/**
 * Listas básicas do Livro do Jogador que a 5e-FastAPI ainda não serve (não há endpoint de perícias,
 * idiomas nem alinhamentos). Quando a API ganhar esses endpoints, troque por consultas no catálogo.
 * As chaves são fixas (e iguais às da Open5e) porque já ficam guardadas nos personagens.
 */

/** Nome do atributo em português → atributo. */
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Força',
  dex: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  wis: 'Sabedoria',
  cha: 'Carisma',
};

export interface SrdSkill {
  key: string;
  name: string;
  ability: Ability;
  /** Outros nomes usados nos textos (traduções diferentes entre livros). */
  aliases?: string[];
}

export const SKILLS: SrdSkill[] = [
  { key: 'acrobatics', name: 'Acrobacia', ability: 'dex' },
  { key: 'animal-handling', name: 'Lidar com Animais', ability: 'wis', aliases: ['Adestrar Animais'] },
  { key: 'arcana', name: 'Arcanismo', ability: 'int' },
  { key: 'athletics', name: 'Atletismo', ability: 'str' },
  { key: 'deception', name: 'Enganação', ability: 'cha' },
  { key: 'history', name: 'História', ability: 'int' },
  { key: 'insight', name: 'Intuição', ability: 'wis' },
  { key: 'intimidation', name: 'Intimidação', ability: 'cha' },
  { key: 'investigation', name: 'Investigação', ability: 'int' },
  { key: 'medicine', name: 'Medicina', ability: 'wis' },
  { key: 'nature', name: 'Natureza', ability: 'int' },
  { key: 'perception', name: 'Percepção', ability: 'wis' },
  { key: 'performance', name: 'Atuação', ability: 'cha' },
  { key: 'persuasion', name: 'Persuasão', ability: 'cha' },
  { key: 'religion', name: 'Religião', ability: 'int' },
  { key: 'sleight-of-hand', name: 'Prestidigitação', ability: 'dex' },
  { key: 'stealth', name: 'Furtividade', ability: 'dex' },
  { key: 'survival', name: 'Sobrevivência', ability: 'wis' },
].sort((a, b) => a.name.localeCompare(b.name)) as SrdSkill[];

export interface SrdLanguage {
  key: string;
  name: string;
  is_exotic: boolean;
  is_secret: boolean;
}

/** Idiomas padrão e raros do Livro do Jogador 2024 (capítulo 2). */
export const LANGUAGES: SrdLanguage[] = [
  ...[
    ['common', 'Comum'],
    ['common-sign', 'Língua de Sinais Comum'],
    ['draconic', 'Dracônico'],
    ['dwarvish', 'Anão'],
    ['elvish', 'Élfico'],
    ['giant', 'Gigante'],
    ['gnomish', 'Gnômico'],
    ['goblin', 'Goblin'],
    ['halfling', 'Pequenino'],
    ['orc', 'Orc'],
  ].map(([key, name]) => ({ key: key!, name: name!, is_exotic: false, is_secret: false })),
  ...[
    ['abyssal', 'Abissal'],
    ['celestial', 'Celestial'],
    ['deep-speech', 'Dialeto Subterrâneo'],
    ['infernal', 'Infernal'],
    ['primordial', 'Primordial'],
    ['sylvan', 'Silvestre'],
    ['undercommon', 'Subcomum'],
  ].map(([key, name]) => ({ key: key!, name: name!, is_exotic: true, is_secret: false })),
  ...[
    ['druidic', 'Druídico'],
    ['thieves-cant', 'Gíria de Ladrão'],
  ].map(([key, name]) => ({ key: key!, name: name!, is_exotic: true, is_secret: true })),
];

export interface SrdAlignment {
  key: string;
  societal_attitude: 'lawful' | 'neutral' | 'chaotic';
  morality: 'good' | 'neutral' | 'evil';
}

export const ALIGNMENTS: SrdAlignment[] = (['lawful', 'neutral', 'chaotic'] as const).flatMap((societal_attitude) =>
  (['good', 'neutral', 'evil'] as const).map((morality) => ({
    key: societal_attitude === 'neutral' && morality === 'neutral' ? 'neutral' : `${societal_attitude}-${morality}`,
    societal_attitude,
    morality,
  })),
);
