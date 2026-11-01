import type { Tracking } from './index';

/**
 * Calibração da mesa: liga os pixels da câmera ao grid. A homografia leva um ponto da câmera para um
 * quadrado unitário (0 a 1 nos dois eixos), então não depende do tamanho da TV nem de quantas células
 * ela tem: `cols` e `rows` só entram em `toCell`. Matemática pura, sem OpenCV nem DOM.
 */

/** Matriz 3x3 em linha, 9 números: [h0 h1 h2, h3 h4 h5, h6 h7 h8]. */
export type Homography = number[];

export interface Calibration {
  /** Cantos da mesa vistos pela câmera, em pixels: superior esquerdo, superior direito, inferior direito, inferior esquerdo. */
  corners: [Tracking.Point, Tracking.Point, Tracking.Point, Tracking.Point];
  /** Resolução do frame em que foi calibrada. Se mudar, é preciso calibrar de novo. */
  cameraSize: { width: number; height: number };
  /** Câmera (pixels) para o quadrado unitário. */
  homography: Homography;
}

/** Ids dos marcadores dos cantos, na mesma ordem de `Calibration.corners`. */
export type CornerIds = [topLeft: number, topRight: number, bottomRight: number, bottomLeft: number];

const UNIT: Calibration['corners'] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/**
 * Resolve o sistema linear `coeficientes · incógnitas = resultados` por eliminação de Gauss com pivô
 * parcial. `coeficientes` é quadrada (uma linha por equação). `null` se não houver solução única.
 */
function solve(coeficientes: number[][], resultados: number[]): number[] | null {
  const total = resultados.length;

  // Eliminação: zera tudo abaixo da diagonal, coluna por coluna.
  for (let coluna = 0; coluna < total; coluna++) {
    // Pivô parcial: traz para a diagonal a linha de maior valor absoluto nessa coluna.
    let linhaPivo = coluna;
    
    for (let linha = coluna + 1; linha < total; linha++) {
      if (Math.abs(coeficientes[linha]![coluna]!) > Math.abs(coeficientes[linhaPivo]![coluna]!))
         linhaPivo = linha;
    }

    if (Math.abs(coeficientes[linhaPivo]![coluna]!) < 1e-10) 
      return null;

    [coeficientes[coluna], coeficientes[linhaPivo]] = [coeficientes[linhaPivo]!, coeficientes[coluna]!];
    [resultados[coluna], resultados[linhaPivo]] = [resultados[linhaPivo]!, resultados[coluna]!];

    for (let linha = coluna + 1; linha < total; linha++) {
      const fator = coeficientes[linha]![coluna]! / coeficientes[coluna]![coluna]!;

    for (let k = coluna; k < total; k++) 
      coeficientes[linha]![k]! -= fator * coeficientes[coluna]![k]!;

      resultados[linha]! -= fator * resultados[coluna]!;
    }
  }

  // Substituição de volta: da última linha para a primeira.
  const incognitas = new Array<number>(total).fill(0);
  for (let linha = total - 1; linha >= 0; linha--) {
    let soma = resultados[linha]!;
    for (let k = linha + 1; k < total; k++) soma -= coeficientes[linha]![k]! * incognitas[k]!;
    incognitas[linha] = soma / coeficientes[linha]![linha]!;
  }
  return incognitas;
}

/** Calibra a partir dos 4 cantos da mesa na câmera. `null` se os cantos forem degenerados (alinhados ou repetidos). */
export function calibrate(
  corners: Calibration['corners'],
  cameraSize: Calibration['cameraSize'],
): Calibration | null {
  const coeficientes: number[][] = [];
  const resultados: number[] = [];
  corners.forEach(([x, y], i) => {
    const [u, v] = UNIT[i]!;
    coeficientes.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    resultados.push(u);
    coeficientes.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    resultados.push(v);
  });
  const h = solve(coeficientes, resultados);
  if (!h) return null;
  return { corners, cameraSize, homography: [...h, 1] };
}

/**
 * Calibra a partir dos marcadores dos cantos (ex.: desenhados pela própria TV). Usa o centro de cada um,
 * então a mesa é o quadrilátero entre os centros. `null` se faltar algum dos quatro.
 */
export function fromMarkers(
  markers: Tracking.Marker[],
  ids: CornerIds,
  cameraSize: Calibration['cameraSize'],
): Calibration | null {
  const centers = ids.map((id) => markers.find((m) => m.id === id)?.center);
  if (centers.some((c) => !c)) return null;
  return calibrate(centers as unknown as Calibration['corners'], cameraSize);
}

/** Ponto da câmera no quadrado unitário da mesa. Pode cair fora de 0–1 se o ponto estiver fora da mesa. */
export function project(calibration: Calibration, [x, y]: Tracking.Point): Tracking.Point {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = calibration.homography as [
    number, number, number, number, number, number, number, number, number,
  ];
  const w = h6 * x + h7 * y + h8;
  return [(h0 * x + h1 * y + h2) / w, (h3 * x + h4 * y + h5) / w];
}

/** Célula do grid (começando em 0) sob um ponto da câmera. `null` se estiver fora da mesa. */
export function toCell(
  calibration: Calibration,
  point: Tracking.Point,
  cols: number,
  rows: number,
): { col: number; row: number } | null {
  const [u, v] = project(calibration, point);
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  return { col: Math.floor(u * cols), row: Math.floor(v * rows) };
}

/** Diz se o frame tem o tamanho em que a calibração foi feita. */
export function matches(calibration: Calibration, frame: Pick<Tracking.Frame, 'width' | 'height'>): boolean {
  return calibration.cameraSize.width === frame.width && calibration.cameraSize.height === frame.height;
}
