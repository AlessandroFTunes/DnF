/**
 * Rastreio de tokens reais: o Port. Define o que o resto do app espera de um detector de marcadores
 * (ArUco) sem conhecer OpenCV, câmera ou DOM. Quem implementa recebe um frame e devolve os marcadores
 * vistos nele, em pixels do frame. Calibração, célula do grid e estabilização ficam por cima disso.
 */
export namespace Tracking {
  export type Point = [x: number, y: number];

  /** Um frame de vídeo em RGBA, 4 bytes por pixel. O `ImageData` do navegador já encaixa aqui. */
  export interface Frame {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  /** Um marcador visto no frame. */
  export interface Marker {
    /** Id do marcador dentro do dicionário (token ou canto da calibração). */
    id: number;
    /** Cantos em pixels do frame, no sentido horário a partir do canto superior esquerdo do marcador. */
    corners: [Point, Point, Point, Point];
    /** Média dos quatro cantos. */
    center: Point;
  }

  export interface Detector {
    /** Marcadores do frame, sem ordem garantida. Vazio se não vir nenhum. */
    detect(frame: Frame): Marker[];
    /** Libera a memória do detector. Não use depois disso. */
    dispose(): void;
  }

  export function center(corners: Marker['corners']): Point {
    let x = 0;
    let y = 0;
    for (const [cx, cy] of corners) {
      x += cx;
      y += cy;
    }
    return [x / 4, y / 4];
  }
}
