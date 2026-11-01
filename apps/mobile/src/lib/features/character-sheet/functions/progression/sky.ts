/** A árvore é sempre noturna (céu estilo Skyrim), nos dois temas. */
export const SKY = {
  bg: '#07080F',
  star: '#FFE6B0',
  glow: '#FFB45C',
  locked: '#6E7090',
  line: '#FFD9A0',
  text: '#F3EBDD',
  muted: '#9AA0BE',
  sub: '#C9B3FF',
  asi: '#9CCBFF',
};

/** Paleta da nebulosa de cada constelação (classe = brasa, subclasses = tons frios). */
export const NEBULAE = [
  ['#B4361A', '#E8822E', '#5A1A3A'],
  ['#4B2A8C', '#8F4BC9', '#1B3A73'],
  ['#1E5A7A', '#3FA3B8', '#2C1F5E'],
  ['#7A1F4D', '#C2477E', '#2E1A55'],
  ['#2F6B3A', '#7FB86A', '#173445'],
];

export const MAX_LEVEL = 20;

/** Número pseudoaleatório estável a partir de um texto (posições sempre iguais). */
export function seeded(text: string, n: number): number {
  let h = 2166136261;
  for (const ch of `${text}:${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
