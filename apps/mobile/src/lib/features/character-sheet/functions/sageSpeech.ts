import { isSpellcastingFeature, plainText } from '@dnf/sdk/srd';
import { ttsHash } from '../../lib/tts-key';

/**
 * Roteiro do Grande Sábio: abertura, confirmação, apresentação da habilidade pela categoria, resumo da regra e
 * fechamento. Cada parte tem variações; a escolha sai do nome da habilidade, então a mesma habilidade diz
 * sempre a mesma frase (e toca do cache, sem gastar créditos) e habilidades diferentes soam diferentes.
 * A pontuação ("...", "!") é o que dá a entonação na ElevenLabs.
 */

/** De onde a habilidade vem; decide o título dito ("Habilidade Inata"). */
export type SageSource = 'class' | 'subclass' | 'species' | 'background' | 'feat';

/** Título de cada categoria, no estilo do Grande Sábio, com o artigo. */
export const SAGE_CATEGORY = {
  magic: { title: 'Habilidade Mágica', article: 'Sua' },
  innate: { title: 'Habilidade Inata', article: 'Sua' },
  extra: { title: 'Habilidade Extra', article: 'Sua' },
  unique: { title: 'Habilidade Única', article: 'Sua' },
  origin: { title: 'Habilidade de Origem', article: 'Sua' },
  feat: { title: 'Talento', article: 'Seu' },
} as const;
export type SageCategory = keyof typeof SAGE_CATEGORY;

const BY_SOURCE: Record<SageSource, SageCategory> = {
  class: 'extra',
  subclass: 'unique',
  species: 'innate',
  background: 'origin',
  feat: 'feat',
};

/** Nomes que soam a magia viram "Habilidade Mágica", venham de onde vierem. */
const MAGIC = /magi|m[áa]gic|feiti|arcan|conjur|ritual|truque|encant|sortil|brux/i;

export function sageCategory(name: string, source: SageSource): SageCategory {
  if (source !== 'feat' && (isSpellcastingFeature(name) || MAGIC.test(name))) return 'magic';
  return BY_SOURCE[source];
}

const OPENINGS = [
  'É hora... do Grande Sábio!',
  'Grande Sábio... ativado!',
  'Aviso! O Grande Sábio foi ativado.',
  'Hm... Parece que é hora do Grande Sábio!',
  'Pergunta detectada... Grande Sábio, ativado!',
];

const ACKS = [
  'Entendido. Irei te ajudar.',
  'Ok... irei te ajudar.',
  'Analisando... Análise concluída.',
  'Consultando os registros... Pronto.',
  'Resposta.',
];

/** `{a}` artigo, `{c}` categoria, `{n}` nome. */
const INTROS = [
  '{a} {c}, chamada {n}...',
  '{c} identificada: {n}.',
  'Sobre a {c} {n}...',
  '{a} {c}, {n}, funciona assim:',
];
/** O mesmo, para o masculino (Talento). */
const INTROS_M = ['{a} {c}, chamado {n}...', '{c} identificado: {n}.', 'Sobre o {c} {n}...', '{a} {c}, {n}, funciona assim:'];

const CLOSINGS = ['Isso é tudo.', 'Fim da análise.', 'Use com sabedoria.', 'Não há mais nada a relatar.', ''];

/** O `/tts` aceita até 600 letras. */
const SPEECH_MAX = 590;

/** As primeiras frases da regra, até `max` letras, sem cortar no meio da frase (se der). */
export function quickSummary(desc = '', max = 380): string {
  const text = plainText(desc).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || `${text.slice(0, max).replace(/\s+\S*$/, '')}.`).trim();
}

export function sageSpeech(name: string, desc: string | undefined, category: SageCategory): string {
  const seed = parseInt(ttsHash(name), 36);
  const pick = <T>(list: readonly T[], salt: number) => list[(seed >>> salt) % list.length]!;
  const { title, article } = SAGE_CATEGORY[category];
  const intro = pick(article === 'Seu' ? INTROS_M : INTROS, 6)
    .replace('{a}', article)
    .replace('{c}', title)
    .replace('{n}', name);
  const head = `${pick(OPENINGS, 0)} ${pick(ACKS, 3)} ${intro}`;
  const close = pick(CLOSINGS, 9);
  const summary = quickSummary(desc, SPEECH_MAX - head.length - close.length - 2) || 'Não há registros.';
  return [head, summary, close].filter(Boolean).join(' ');
}
