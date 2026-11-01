import { describe, expect, test } from 'bun:test';
import { blockers, insidePolygon, visibilityPolygon } from '../src/grid/visibility';
import { Grid } from '../src/grid';

describe('visibilityPolygon', () => {
  test('sem paredes vê o raio todo', () => {
    const poly = visibilityPolygon([0, 0], 100, []);
    expect(insidePolygon([90, 0], poly)).toBe(true);
    expect(insidePolygon([0, -99], poly)).toBe(true);
    expect(insidePolygon([150, 0], poly)).toBe(false);
  });

  test('parede bloqueia o que está atrás', () => {
    const walls = blockers([{ a: [50, -100], b: [50, 100], kind: 'wall', open: false }]);
    const poly = visibilityPolygon([0, 0], 200, walls);
    expect(insidePolygon([40, 0], poly)).toBe(true);
    expect(insidePolygon([120, 0], poly)).toBe(false);
  });

  test('porta aberta e janela deixam passar; porta fechada não', () => {
    const wall = (kind: 'door' | 'window', open: boolean) =>
      blockers([{ a: [50, -100], b: [50, 100], kind, open }]);
    expect(insidePolygon([120, 0], visibilityPolygon([0, 0], 200, wall('door', true)))).toBe(true);
    expect(insidePolygon([120, 0], visibilityPolygon([0, 0], 200, wall('window', false)))).toBe(true);
    expect(insidePolygon([120, 0], visibilityPolygon([0, 0], 200, wall('door', false)))).toBe(false);
  });

  test('enxerga em volta de um canto', () => {
    const walls = blockers([{ a: [50, -10], b: [50, 100], kind: 'wall', open: false }]);
    const poly = visibilityPolygon([0, 0], 200, walls);
    expect(insidePolygon([120, -50], poly)).toBe(true);
    expect(insidePolygon([120, 50], poly)).toBe(false);
  });
});

describe('Grid.Scene', () => {
  test('cena vazia ganha padrões', () => {
    const scene = Grid.parseScene(undefined);
    expect(scene.cell.size).toBe(70);
    expect(scene.tokens).toEqual([]);
    expect(scene.fog.enabled).toBe(false);
  });

  test('token ganha padrões e cena inválida é recusada', () => {
    const scene = Grid.parseScene({ tokens: [{ id: 'a', name: 'Goblin', x: 1, y: 2 }] });
    expect(scene.tokens[0]).toMatchObject({ size: 1, hidden: false, player: false, vision: 0 });
    expect(() => Grid.parseScene({ tokens: [{ id: 'a' }] })).toThrow();
  });

  test('url do mapa só aceita imagem', () => {
    expect(Grid.Info.shape.url.safeParse('m/mapas/a.pdf').success).toBe(false);
    expect(Grid.Info.shape.url.safeParse('m/mapas/a.WEBP').success).toBe(true);
  });
});
