/**
 * Visão e luz: dado um ponto e as paredes, devolve o polígono do que dá para ver dele.
 * Funções puras (sem Pixi nem DOM), em pixels do mapa, para o renderer e para testes.
 */
export type Point = [number, number];
export interface Segment {
  a: Point;
  b: Point;
}

/** Quem bloqueia visão: parede e porta fechada. Janela e porta aberta deixam passar. */
export function blockers(
  walls: readonly { a: Point; b: Point; kind: 'wall' | 'door' | 'window'; open: boolean }[],
): Segment[] {
  return walls
    .filter((wall) => wall.kind === 'wall' || (wall.kind === 'door' && !wall.open))
    .map(({ a, b }) => ({ a, b }));
}

/** Distância em que o raio `origin + t*dir` toca o segmento, ou null. `dir` não precisa ser unitário. */
function hit(origin: Point, dir: Point, seg: Segment): number | null {
  const ex = seg.b[0] - seg.a[0];
  const ey = seg.b[1] - seg.a[1];
  const denom = dir[0] * ey - dir[1] * ex;
  if (Math.abs(denom) < 1e-9) return null; // paralelo
  const ox = seg.a[0] - origin[0];
  const oy = seg.a[1] - origin[1];
  const t = (ox * ey - oy * ex) / denom;
  const u = (ox * dir[1] - oy * dir[0]) / denom;
  return t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}

/**
 * Polígono de visão de `origin`, limitado ao raio `radius`. Varre os ângulos dos extremos das
 * paredes (±ε) e, em cada um, lança um raio até a parede mais próxima (ou até o limite do raio).
 * Os pontos saem ordenados por ângulo, prontos para preencher.
 */
export function visibilityPolygon(origin: Point, radius: number, segments: readonly Segment[]): Point[] {
  const [ox, oy] = origin;
  const r = Math.max(1, radius);
  // Só paredes que chegam perto o bastante importam; o resto só custa tempo.
  const near = segments.filter((seg) => distanceToSegment(origin, seg) <= r * 1.5);
  // Moldura em volta do raio: garante que todo raio acaba em algo.
  const box: Segment[] = [
    { a: [ox - r, oy - r], b: [ox + r, oy - r] },
    { a: [ox + r, oy - r], b: [ox + r, oy + r] },
    { a: [ox + r, oy + r], b: [ox - r, oy + r] },
    { a: [ox - r, oy + r], b: [ox - r, oy - r] },
  ];
  const all = [...near, ...box];

  const angles = new Set<number>();
  for (const { a, b } of all) {
    for (const [x, y] of [a, b]) {
      const angle = Math.atan2(y - oy, x - ox);
      angles.add(angle - 1e-4);
      angles.add(angle);
      angles.add(angle + 1e-4);
    }
  }

  const points: { angle: number; point: Point }[] = [];
  for (const angle of angles) {
    const dir: Point = [Math.cos(angle), Math.sin(angle)];
    let closest = Infinity;
    for (const seg of all) {
      const t = hit(origin, dir, seg);
      if (t !== null && t < closest) closest = t;
    }
    if (closest === Infinity) continue;
    points.push({ angle, point: [ox + dir[0] * closest, oy + dir[1] * closest] });
  }
  return points.sort((p, q) => p.angle - q.angle).map((p) => p.point);
}

function distanceToSegment(p: Point, { a, b }: Segment): number {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len2 = ex * ex + ey * ey;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / len2));
  return Math.hypot(p[0] - (a[0] + t * ex), p[1] - (a[1] + t * ey));
}

export { distanceToSegment };

/** O ponto está dentro do polígono? (par-ímpar) */
export function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
