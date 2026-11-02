import { Tracking } from '../tracking';

/**
 * Adapter do `Tracking.Detector` com OpenCV.js (ArUco). Fica numa pasta própria, como o `gridpixi`, para o
 * OpenCV (~13 MB) só entrar no bundle de quem importar `@dnf/core/trackingopencv`. O módulo é carregado
 * sob demanda em `create`, e só no cliente: o WASM não roda no SSR nem no React Native.
 */
export namespace TrackingOpenCv {
  /** Dicionários ArUco do OpenCV. Quanto menor o grid, mais longe o marcador é detectado. */
  export type Dictionary =
    | 'DICT_4X4_50'
    | 'DICT_4X4_100'
    | 'DICT_4X4_250'
    | 'DICT_4X4_1000'
    | 'DICT_5X5_50'
    | 'DICT_5X5_100'
    | 'DICT_5X5_250'
    | 'DICT_5X5_1000'
    | 'DICT_6X6_50'
    | 'DICT_6X6_100'
    | 'DICT_6X6_250'
    | 'DICT_6X6_1000';

  export interface Options {
    /** Dicionário dos marcadores impressos. Padrão `DICT_4X4_50` (ids 0 a 49). */
    dictionary?: Dictionary;
  }

  // O pacote não tipa o módulo `aruco`; só o que usamos aqui.
  interface Mat {
    data: Uint8Array;
    data32F: Float32Array;
    data32S: Int32Array;
    roi(rect: unknown): Mat;
    copyTo(dst: Mat): void;
    delete(): void;
  }
  interface MatVector {
    size(): number;
    get(i: number): Mat;
    delete(): void;
  }
  interface Aruco {
    detectMarkers(image: Mat, corners: MatVector, ids: Mat, rejected: MatVector): void;
    delete(): void;
  }
  interface Dictionary_ {
    generateImageMarker(id: number, size: number, image: Mat, borderBits: number): void;
    delete(): void;
  }
  interface Cv {
    Mat: {
      new (): Mat;
      new (rows: number, cols: number, type: number, scalar: unknown): Mat;
    };
    Scalar: new (...values: number[]) => unknown;
    Rect: new (x: number, y: number, width: number, height: number) => unknown;
    CV_8UC1: number;
    COLOR_GRAY2RGBA: number;
    MatVector: new () => MatVector;
    CV_8UC4: number;
    COLOR_RGBA2GRAY: number;
    matFromArray(rows: number, cols: number, type: number, data: ArrayLike<number>): Mat;
    cvtColor(src: Mat, dst: Mat, code: number): void;
    getPredefinedDictionary(id: number): Dictionary_;
    aruco_DetectorParameters: new () => { delete(): void };
    aruco_RefineParameters: new (min: number, rate: number, check: boolean) => { delete(): void };
    aruco_ArucoDetector: new (dictionary: unknown, params: unknown, refine: unknown) => Aruco;
    [dictionary: string]: unknown;
  }

  async function load(): Promise<Cv> {
    const mod = (await import('@techstark/opencv-js')).default as unknown as Cv | Promise<Cv>;
    if (mod instanceof Promise) return await mod;
    if (mod.Mat) return mod;
    await new Promise<void>((resolve) => {
      (mod as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = resolve;
    });
    return mod;
  }

  /**
   * Imagem de um marcador para exibir ou imprimir: quadrado de `size` px, RGBA, com margem branca ao redor
   * (o detector precisa dela para achar a borda preta).
   */
  export async function renderMarker(
    id: number,
    size: number,
    dictionaryName: Dictionary = 'DICT_4X4_50',
  ): Promise<Tracking.Frame> {
    const cv = await load();
    const dictionary = cv.getPredefinedDictionary(cv[dictionaryName] as number);
    const margem = Math.round(size / 6);
    const lado = size - margem * 2;
    const marker = new cv.Mat();
    const gray = new cv.Mat(size, size, cv.CV_8UC1, new cv.Scalar(255));
    const rgba = new cv.Mat();
    try {
      dictionary.generateImageMarker(id, lado, marker, 1);
      const area = gray.roi(new cv.Rect(margem, margem, lado, lado));
      marker.copyTo(area);
      area.delete();
      cv.cvtColor(gray, rgba, cv.COLOR_GRAY2RGBA);
      return { data: new Uint8ClampedArray(rgba.data), width: size, height: size };
    } finally {
      marker.delete();
      gray.delete();
      rgba.delete();
      dictionary.delete();
    }
  }

  export async function create(options: Options = {}): Promise<Tracking.Detector> {
    const cv = await load();
    const dictionary = cv.getPredefinedDictionary(cv[options.dictionary ?? 'DICT_4X4_50'] as number);
    const params = new cv.aruco_DetectorParameters();
    const refine = new cv.aruco_RefineParameters(10, 3, true);
    const aruco = new cv.aruco_ArucoDetector(dictionary, params, refine);

    return {
      detect(frame) {
        const rgba = cv.matFromArray(frame.height, frame.width, cv.CV_8UC4, frame.data);
        const gray = new cv.Mat();
        const corners = new cv.MatVector();
        const ids = new cv.Mat();
        const rejected = new cv.MatVector();
        try {
          cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
          aruco.detectMarkers(gray, corners, ids, rejected);

          const markers: Tracking.Marker[] = [];
          for (let i = 0; i < corners.size(); i++) {
            const quad = corners.get(i);
            const c = quad.data32F;
            const points: Tracking.Marker['corners'] = [
              [c[0]!, c[1]!],
              [c[2]!, c[3]!],
              [c[4]!, c[5]!],
              [c[6]!, c[7]!],
            ];
            markers.push({ id: ids.data32S[i]!, corners: points, center: Tracking.center(points) });
            quad.delete();
          }
          return markers;
        } finally {
          rgba.delete();
          gray.delete();
          corners.delete();
          ids.delete();
          rejected.delete();
        }
      },
      dispose() {
        aruco.delete();
        refine.delete();
        params.delete();
        dictionary.delete();
      },
    };
  }
}
