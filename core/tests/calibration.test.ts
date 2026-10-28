import { describe, expect, test } from 'bun:test';
import { Tracking } from '../src/tracking';
import { calibrate, fromMarkers, matches, project, toCell } from '../src/tracking/calibration';

const size = { width: 640, height: 480 };

// Mesa vista de lado: trapézio na câmera.
const trapezio: Tracking.Point[] = [
  [100, 50],
  [540, 80],
  [600, 440],
  [60, 400],
];

describe('calibrate', () => {
  test('os cantos caem nos cantos do quadrado unitário', () => {
    const cal = calibrate(trapezio as never, size)!;
    const [tl, tr, br, bl] = trapezio.map((p) => project(cal, p));
    expect(tl![0]).toBeCloseTo(0, 6);
    expect(tl![1]).toBeCloseTo(0, 6);
    expect(tr![0]).toBeCloseTo(1, 6);
    expect(br![1]).toBeCloseTo(1, 6);
    expect(bl![0]).toBeCloseTo(0, 6);
  });

  test('retângulo simples é uma escala', () => {
    const cal = calibrate([[0, 0], [200, 0], [200, 100], [0, 100]], size)!;
    const [u, v] = project(cal, [50, 50]);
    expect(u).toBeCloseTo(0.25, 6);
    expect(v).toBeCloseTo(0.5, 6);
  });

  test('cantos alinhados são degenerados', () => {
    expect(calibrate([[0, 0], [10, 0], [20, 0], [30, 0]], size)).toBeNull();
  });
});

describe('toCell', () => {
  const cal = calibrate([[0, 0], [400, 0], [400, 200], [0, 200]], size)!;

  test('mapeia pixel para célula conforme cols e rows', () => {
    expect(toCell(cal, [10, 10], 4, 2)).toEqual({ col: 0, row: 0 });
    expect(toCell(cal, [150, 150], 4, 2)).toEqual({ col: 1, row: 1 });
    expect(toCell(cal, [399, 199], 4, 2)).toEqual({ col: 3, row: 1 });
  });

  test('a mesma calibração serve para outro número de células', () => {
    expect(toCell(cal, [150, 150], 8, 4)).toEqual({ col: 3, row: 3 });
  });

  test('fora da mesa é null', () => {
    expect(toCell(cal, [-5, 10], 4, 2)).toBeNull();
    expect(toCell(cal, [400, 10], 4, 2)).toBeNull();
    expect(toCell(cal, [10, 250], 4, 2)).toBeNull();
  });

  test('perspectiva: o centro do trapézio é o centro da mesa', () => {
    const t = calibrate(trapezio as never, size)!;
    // Interseção das diagonais é o centro projetivo da mesa.
    const [u, v] = project(t, [(100 + 600) / 2 - 15, 245]);
    expect(u).toBeGreaterThan(0.3);
    expect(u).toBeLessThan(0.7);
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThan(0.7);
  });
});

describe('fromMarkers', () => {
  const marker = (id: number, [x, y]: Tracking.Point): Tracking.Marker => ({
    id,
    center: [x, y],
    corners: [[x, y], [x, y], [x, y], [x, y]],
  });

  test('calibra pelos centros dos marcadores dos cantos', () => {
    const markers = [marker(2, [200, 100]), marker(0, [0, 0]), marker(9, [5, 5]), marker(1, [200, 0]), marker(3, [0, 100])];
    const cal = fromMarkers(markers, [0, 1, 2, 3], size)!;
    expect(project(cal, [100, 50])[0]).toBeCloseTo(0.5, 6);
  });

  test('falta um canto é null', () => {
    expect(fromMarkers([marker(0, [0, 0]), marker(1, [1, 0])], [0, 1, 2, 3], size)).toBeNull();
  });
});

describe('matches', () => {
  test('compara a resolução do frame', () => {
    const cal = calibrate([[0, 0], [1, 0], [1, 1], [0, 1]], size)!;
    expect(matches(cal, { width: 640, height: 480 })).toBe(true);
    expect(matches(cal, { width: 1280, height: 720 })).toBe(false);
  });
});
