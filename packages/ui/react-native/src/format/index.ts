/** Formato de ficha: +2, +0, −1 (sinal de menos tipográfico). Só formata, não calcula. */
export function formatBonus(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}
