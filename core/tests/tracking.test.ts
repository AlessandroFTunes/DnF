import { describe, expect, test } from 'bun:test';
import cvModule from '@techstark/opencv-js';
import { Tracking } from '../src/tracking';
import { TrackingOpenCv } from '../src/trackingopencv';

/** Frame RGBA branco com o marcador `id` (200 px) colado em (x, y). */
async function frameWith(markers: { id: number; x: number; y: number }[]): Promise<Tracking.Frame> {
  const cv: any = cvModule instanceof Promise ? await cvModule : cvModule;
  if (!cv.Mat) await new Promise<void>((resolve) => (cv.onRuntimeInitialized = resolve));
  const dict = cv.getPredefinedDictionary(cv.DICT_4X4_50);
  const gray = new cv.Mat(480, 640, cv.CV_8UC1, new cv.Scalar(255));
  for (const { id, x, y } of markers) {
    const marker = new cv.Mat();
    dict.generateImageMarker(id, 200, marker, 1);
    marker.copyTo(gray.roi(new cv.Rect(x, y, 200, 200)));
    marker.delete();
  }
  const rgba = new cv.Mat();
  cv.cvtColor(gray, rgba, cv.COLOR_GRAY2RGBA);
  const frame = { data: new Uint8ClampedArray(rgba.data), width: 640, height: 480 };
  gray.delete();
  rgba.delete();
  dict.delete();
  return frame;
}

describe('Tracking.center', () => {
  test('média dos cantos', () => {
    expect(Tracking.center([[0, 0], [10, 0], [10, 10], [0, 10]])).toEqual([5, 5]);
  });
});

describe('TrackingOpenCv', () => {
  test('acha ids e posições de dois marcadores', async () => {
    const detector = await TrackingOpenCv.create();
    const markers = detector.detect(await frameWith([{ id: 7, x: 20, y: 30 }, { id: 12, x: 380, y: 200 }]));
    detector.dispose();

    const byId = new Map(markers.map((m) => [m.id, m]));
    expect([...byId.keys()].sort((a, b) => a - b)).toEqual([7, 12]);
    expect(byId.get(7)!.center[0]).toBeCloseTo(119.5, 0);
    expect(byId.get(7)!.center[1]).toBeCloseTo(129.5, 0);
    expect(byId.get(12)!.center[0]).toBeCloseTo(479.5, 0);
  });

  test('frame sem marcadores devolve lista vazia', async () => {
    const detector = await TrackingOpenCv.create();
    expect(detector.detect(await frameWith([]))).toEqual([]);
    detector.dispose();
  });
});
