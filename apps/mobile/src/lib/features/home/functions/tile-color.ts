/** Cor de cada personagem (estável pelo id), como os perfis coloridos de um app de streaming. */
const TILE_COLORS = ['#C8191E', '#8F4BC9', '#3FA3B8', '#E8822E', '#4B7BE5', '#2F8F5B', '#C2477E', '#B8860B'];

export function tileColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length] ?? TILE_COLORS[0]!;
}
