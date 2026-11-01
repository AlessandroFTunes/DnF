import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/**
 * - `common`: o dado dourado surge girando rápido, desacelera até um giro lento e solta brilhos ao pousar.
 * - `legendary`: o dado roxo treme cada vez mais, quebra em estilhaços e some (nível 20).
 * - `multiclass`: um d20 vermelho e um azul se chocam no centro e do choque nasce um roxo.
 */
export type D20Variant = 'common' | 'legendary' | 'multiclass';

const GOLD = { edge: '#FFD9A0', glow: '#FFB45C' };
const LEGEND = { edge: '#D9C2FF', glow: '#9B5CFF', flash: '#F1E8FF' };
const RED = '#FF5A4E';
const BLUE = '#5AA8FF';
const PURPLE = '#C08CFF';
const PURPLE_GLOW = '#9B5CFF';
const MERGE_FLASH = '#F1E4FF';

// ---------------------------------------------------------------------------
// Linha do tempo (ms)

const APPEAR_MS = 750;
const BURST_AT = 600;
/** Quanto o dado leva para sair do giro rápido e chegar ao giro lento. */
const SETTLE_MS = 2200;
/** Giro lento contínuo (rad/ms). */
const SLOW_SPIN = 0.0006;
const SHAKE_AT = 1000;
const SHATTER_AT = 1800;
const SHATTER_MS = 1100;
const COLLIDE_AT = 950;
const BORN_MS = 650;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const phase = (t: number, start: number, length: number) => clamp01((t - start) / length);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Passa um pouco do tamanho final e volta (o dado "pousa"). */
const easeOutBack = (t: number) => Math.max(0, 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2);

/**
 * Começa girando rápido e freia até o giro lento, sem salto de velocidade na emenda (a curva chega com
 * derivada zero em `SETTLE_MS`).
 */
function spin(t: number, extraYaw: number, extraPitch: number) {
  const left = (1 - phase(t, 0, SETTLE_MS)) ** 4;
  return {
    yaw: SLOW_SPIN * t + extraYaw * (1 - left),
    pitch: 0.35 + Math.sin(t / 1400) * 0.18 + extraPitch * left,
  };
}

/** Número fixo por índice (direção e giro dos estilhaços sempre iguais). */
const fixed = (i: number, n: number) => (((i + 1) * 9301 + n * 49297) % 233280) / 233280;

const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + ((i * 7) % 5) * 0.11;
  return { x: Math.cos(angle), y: Math.sin(angle), reach: 0.75 + ((i * 13) % 7) / 10 };
});

// ---------------------------------------------------------------------------
// Cena

/**
 * Unidades do mundo: 1 = meio dado de altura na tela (`size / 2`). A câmera fica a `CAMERA_Z` com o campo de
 * visão ajustado para isso, e a perspectiva é a mesma do desenho antigo (dado de raio 0,84 visto a 2,2 raios).
 */
const DIE_RADIUS = 0.84;
const CAMERA_Z = DIE_RADIUS * 2.2;

/** Pontos redondos (vértices e brilhos). `fade` apaga os que estão atrás, como o dado é transparente. */
function dotMaterial(color: string, sizePx: number, fade: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      opacity: { value: 1 },
      size: { value: sizePx },
      fade: { value: fade },
      near: { value: CAMERA_Z - DIE_RADIUS },
      far: { value: CAMERA_Z + DIE_RADIUS },
    },
    vertexShader: `
      uniform float size; uniform float fade; uniform float near; uniform float far;
      varying float vLight;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size;
        vLight = 1.0 - clamp((-mv.z - near) / (far - near), 0.0, 1.0) * fade;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float opacity;
      varying float vLight;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(color * vLight, opacity);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const ICOSAHEDRON = new THREE.IcosahedronGeometry(1, 0);
/** 30 arestas, em pares de pontos (x, y, z). */
const EDGE_POSITIONS = Float32Array.from(new THREE.EdgesGeometry(ICOSAHEDRON).attributes.position!.array);
/** Os 12 vértices (a geometria repete cada um nas faces vizinhas). */
const VERTEX_POSITIONS = (() => {
  const seen = new Map<string, number[]>();
  const array = ICOSAHEDRON.attributes.position!.array;
  for (let i = 0; i < array.length; i += 3) {
    const v = [array[i]!, array[i + 1]!, array[i + 2]!];
    seen.set(v.map((n) => n.toFixed(4)).join(), v);
  }
  return Float32Array.from([...seen.values()].flat());
})();

/** d20 em arame: arestas (com espessura, que linha WebGL comum é sempre de 1 px) e vértices. */
function makeDie(color: string, width: number, height: number, dpr: number) {
  // Cópia: o `setPositions` usa o array direto, e os estilhaços do lendário escrevem nele.
  const geometry = new LineSegmentsGeometry().setPositions(EDGE_POSITIONS.slice());
  const material = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: 1.3 * dpr,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  // A névoa preta com mistura aditiva apaga as arestas de trás: dá para ver através do dado.
  material.fog = true;
  material.resolution.set(width, height);
  const edges = new LineSegments2(geometry, material);
  edges.frustumCulled = false;

  const dotGeometry = new THREE.BufferGeometry();
  dotGeometry.setAttribute('position', new THREE.BufferAttribute(VERTEX_POSITIONS, 3));
  const dots = new THREE.Points(dotGeometry, dotMaterial(color, 3 * dpr, 0.9));
  dots.frustumCulled = false;

  const die = new THREE.Group();
  die.add(edges, dots);
  const setOpacity = (opacity: number) => {
    material.opacity = opacity;
    (dots.material as THREE.ShaderMaterial).uniforms.opacity!.value = opacity;
    die.visible = opacity > 0.003;
  };
  return { die, edges, dots, setOpacity };
}

/** Brilhos que estouram do centro. `only` escolhe quais (a multiclasse divide em duas cores). */
function makeSparks(color: string, dpr: number, only: (i: number) => boolean = () => true) {
  const chosen = SPARKS.filter((_, i) => only(i));
  const positions = new Float32Array(chosen.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = dotMaterial(color, 3.2 * dpr, 0);
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  /** Brilhos a `from + reach * avanço` do centro (unidades do mundo), em `burst` de 0 a 1. */
  const update = (cx: number, from: number, reach: number, burst: number) => {
    points.visible = burst > 0 && burst < 1;
    if (!points.visible) return;
    const r = easeOut(burst);
    chosen.forEach((spark, i) => {
      const d = from + r * reach * spark.reach;
      positions.set([cx + spark.x * d, spark.y * d, 0], i * 3);
    });
    geometry.attributes.position!.needsUpdate = true;
    material.uniforms.opacity!.value = 1 - burst;
  };
  return { points, material, update };
}

/** O canvas que o three.js espera; no nativo não existe DOM, só o contexto do GLView. */
function canvasFor(gl: ExpoWebGLRenderingContext) {
  if (Platform.OS === 'web') return (gl as unknown as WebGL2RenderingContext).canvas as HTMLCanvasElement;
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

/**
 * No nativo o `WebGL2RenderingContext` do expo-gl herda do `WebGLRenderingContext`, e o construtor do
 * three (r163+) recusa qualquer `instanceof WebGLRenderingContext` como WebGL 1 e derruba o app. A classe
 * some só durante o construtor, que é o único lugar do three que faz essa checagem.
 */
function withoutWebGL1Check<T>(create: () => T): T {
  if (Platform.OS === 'web') return create();
  const global = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = global.WebGLRenderingContext;
  global.WebGLRenderingContext = undefined;
  try {
    return create();
  } finally {
    global.WebGLRenderingContext = webgl1;
  }
}

/**
 * Monta a cena e anima quadro a quadro no GL, sem passar pelo React. Devolve a função que para e libera tudo.
 */
function start(gl: ExpoWebGLRenderingContext, variant: D20Variant, stageWidth: number, size: number, reduceMotion: boolean) {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  // Pixels do buffer por ponto da tela (espessura das linhas e dos pontos).
  const dpr = height / size;

  const renderer = withoutWebGL1Check(
    () => new THREE.WebGLRenderer({ canvas: canvasFor(gl), context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true }),
  );
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, CAMERA_Z - DIE_RADIUS, CAMERA_Z + DIE_RADIUS * 1.4);
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(1 / CAMERA_Z) * 180) / Math.PI, width / height, 0.1, 20);
  camera.position.z = CAMERA_Z;
  /** Pontos da tela para unidades do mundo. */
  const unit = (px: number) => px / (size / 2);

  const main = makeDie(variant === 'common' ? GOLD.edge : variant === 'legendary' ? LEGEND.edge : PURPLE, width, height, dpr);
  const merge = variant === 'multiclass';
  // Na multiclasse as faíscas nascem vermelhas e azuis (alternadas) e viram roxas.
  const sparks = makeSparks(variant === 'common' ? GOLD.edge : merge ? RED : LEGEND.edge, dpr, (i) => !merge || i % 2 === 1);
  scene.add(main.die, sparks.points);

  const red = merge ? makeDie(RED, width, height, dpr) : null;
  const blue = merge ? makeDie(BLUE, width, height, dpr) : null;
  const blueSparks = merge ? makeSparks(BLUE, dpr, (i) => i % 2 === 0) : null;
  if (red && blue && blueSparks) scene.add(red.die, blue.die, blueSparks.points);

  // Estilhaços: cada aresta voa para fora a partir de onde estava quando o dado quebrou.
  const edgeBuffer = (main.edges.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data;
  const shards = new Float32Array(EDGE_POSITIONS.length);
  const down = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const out = new THREE.Vector3();
  const unrotate = new THREE.Quaternion();

  function shatter(p: number, raw: number) {
    // "Para baixo" no espaço do dado (ele parou de girar), para os estilhaços caírem.
    down.set(0, -1, 0).applyQuaternion(unrotate.copy(main.die.quaternion).invert());
    for (let i = 0; i < EDGE_POSITIONS.length; i += 6) {
      const k = i / 6;
      a.fromArray(EDGE_POSITIONS, i);
      b.fromArray(EDGE_POSITIONS, i + 3);
      mid.addVectors(a, b).multiplyScalar(0.5);
      out.copy(mid).normalize();
      out.x += (fixed(k, 1) - 0.5) * 0.6;
      out.normalize().multiplyScalar(p * (1.1 + 1.2 * fixed(k, 2)));
      out.addScaledVector(down, raw * raw * 0.45);
      axis.set(fixed(k, 3) - 0.5, fixed(k, 4) - 0.5, fixed(k, 5) - 0.5).normalize();
      const turn = p * (fixed(k, 3) - 0.5) * 7;
      const shrink = 1 - 0.4 * p;
      a.sub(mid).applyAxisAngle(axis, turn).multiplyScalar(shrink).add(mid).add(out);
      b.sub(mid).applyAxisAngle(axis, turn).multiplyScalar(shrink).add(mid).add(out);
      a.toArray(shards, i);
      b.toArray(shards, i + 3);
    }
    (edgeBuffer.array as Float32Array).set(shards);
    edgeBuffer.needsUpdate = true;
  }

  function common(t: number) {
    const scale = easeOutBack(phase(t, 0, APPEAR_MS));
    const { yaw, pitch } = spin(t, 9, 2.2);
    main.die.rotation.set(pitch, yaw, 0);
    main.die.scale.setScalar(DIE_RADIUS * Math.max(scale, 0.001));
    main.setOpacity(clamp01(scale));
    sparks.update(0, 0.36, 0.84, phase(t, BURST_AT, 900));
    return true;
  }

  function legendary(t: number) {
    const scale = easeOutBack(phase(t, 0, APPEAR_MS));
    // Ao quebrar, o giro para onde estava.
    const { yaw, pitch } = spin(Math.min(t, SHATTER_AT), 9, 2.2);
    const shake = t < SHATTER_AT ? phase(t, SHAKE_AT, SHATTER_AT - SHAKE_AT) ** 2 * unit(5) : 0;
    main.die.rotation.set(pitch, yaw, 0);
    main.die.position.set(Math.sin(t * 0.11) * shake, Math.cos(t * 0.137) * shake, 0);
    main.die.scale.setScalar(DIE_RADIUS * Math.max(scale, 0.001));
    const raw = phase(t, SHATTER_AT, SHATTER_MS);
    if (raw > 0) shatter(easeOut(raw), raw);
    main.setOpacity(raw > 0 ? 1 - raw : clamp01(scale));
    // Estilhaço é só aresta: os vértices somem na quebra.
    main.dots.visible = raw === 0;
    sparks.update(0, 0.36, 0.84, raw > 0 ? phase(t, SHATTER_AT, 900) : 0);
    // Depois que tudo some, não precisa mais desenhar.
    return t < SHATTER_AT + SHATTER_MS;
  }

  function multiclass(t: number) {
    const half = unit(stageWidth) / 2;
    const approach = phase(t, 0, COLLIDE_AT) ** 2;
    const incoming = 1 - phase(t, COLLIDE_AT, 140);
    const travel = (half + 0.4) * (1 - approach) + 0.32;
    for (const [die, side, yaw, pitch] of [
      [red!, -1, t * 0.012, 0.4 + t * 0.004],
      [blue!, 1, -t * 0.011, 0.7 - t * 0.005],
    ] as const) {
      die.die.position.set(side * travel, 0, 0);
      die.die.rotation.set(pitch, yaw, 0);
      die.die.scale.setScalar(0.6);
      die.setOpacity(incoming);
    }
    const born = easeOutBack(phase(t, COLLIDE_AT, BORN_MS));
    const { yaw, pitch } = spin(Math.max(0, t - COLLIDE_AT), 7, 1.6);
    main.die.rotation.set(pitch, yaw, 0);
    main.die.scale.setScalar(DIE_RADIUS * Math.max(born, 0.001));
    main.setOpacity(clamp01(born));
    const burst = t >= COLLIDE_AT ? phase(t, COLLIDE_AT, 900) : 0;
    if (burst >= 0.35) {
      sparks.material.uniforms.color!.value.set(PURPLE);
      blueSparks!.material.uniforms.color!.value.set(PURPLE);
    }
    sparks.update(0, 0.2, 1, burst);
    blueSparks!.update(0, 0.2, 1, burst);
    return true;
  }

  const step = variant === 'common' ? common : variant === 'legendary' ? legendary : multiclass;
  const render = () => {
    renderer.render(scene, camera);
    gl.endFrameEXP();
  };

  let frame = 0;
  if (reduceMotion) {
    // Com "reduzir movimento", só o quadro final (no lendário o dado já quebrou: não desenha nada).
    step(variant === 'legendary' ? 0 : COLLIDE_AT + SETTLE_MS);
    if (variant === 'legendary') main.setOpacity(0);
    render();
  } else {
    const began = Date.now();
    const tick = () => {
      const going = step(Date.now() - began);
      render();
      if (going) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  return () => {
    cancelAnimationFrame(frame);
    scene.traverse((object) => {
      if (object instanceof THREE.Points || object instanceof LineSegments2) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
    renderer.dispose();
  };
}

// ---------------------------------------------------------------------------
// Aura e clarão: gradiente fixo do SVG, animado só em escala e opacidade pelo driver nativo.

const useNativeDriver = Platform.OS !== 'web';
const nativeEaseOut = Easing.out(Easing.cubic);
const nativeEaseOutBack = Easing.out(Easing.back(1.7));

const timing = (value: Animated.Value, toValue: number, duration: number, easing = nativeEaseOut) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver });

/** Aura: cresce com o dado e pulsa devagar. No lendário acende enquanto ele treme e apaga quando quebra. */
function glowAnimation(variant: D20Variant, scale: Animated.Value, opacity: Animated.Value) {
  const pulse = (low: number, high: number) =>
    Animated.loop(Animated.sequence([timing(opacity, low, 1570, Easing.inOut(Easing.sin)), timing(opacity, high, 1570, Easing.inOut(Easing.sin))]));
  if (variant === 'multiclass') {
    return Animated.sequence([
      Animated.delay(COLLIDE_AT),
      Animated.parallel([timing(scale, 1, BORN_MS, nativeEaseOutBack), timing(opacity, 0.65, BORN_MS)]),
      pulse(0.25, 0.65),
    ]);
  }
  const grow = timing(scale, 1, APPEAR_MS, nativeEaseOutBack);
  if (variant === 'legendary') {
    return Animated.parallel([
      grow,
      Animated.sequence([
        timing(opacity, 0.35, BURST_AT),
        Animated.delay(SHAKE_AT - BURST_AT),
        timing(opacity, 1, SHATTER_AT - SHAKE_AT, Easing.in(Easing.quad)),
        timing(opacity, 0.35, SHATTER_MS),
      ]),
    ]);
  }
  return Animated.parallel([grow, Animated.sequence([timing(opacity, 0.95, BURST_AT), timing(opacity, 0.4, 700), pulse(0.6, 0.35)])]);
}

/** Clarão: disco que se abre do centro e some (quebra do lendário e choque da multiclasse). */
function flashAnimation(variant: D20Variant, scale: Animated.Value, opacity: Animated.Value) {
  const at = variant === 'legendary' ? SHATTER_AT : COLLIDE_AT;
  const length = variant === 'legendary' ? 520 : 560;
  return Animated.sequence([
    Animated.delay(at),
    Animated.parallel([
      timing(scale, 1, length),
      Animated.sequence([timing(opacity, 0.9, 0, Easing.linear), timing(opacity, 0, length, Easing.linear)]),
    ]),
  ]);
}

/**
 * d20 3D (three.js num GLView) girando. Começa rápido e desacelera até um giro lento contínuo; a quebra do
 * lendário e o choque da multiclasse também acontecem aqui. `width` é a largura do palco (a multiclasse é
 * mais larga, os dados entram pelos lados); a altura é `size`.
 */
export function D20Animation({
  variant,
  size,
  width = size,
  reduceMotion,
}: {
  variant: D20Variant;
  size: number;
  width?: number;
  reduceMotion: boolean;
}) {
  const stop = useRef<(() => void) | null>(null);
  const [glowScale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.001));
  const [glowOpacity] = useState(() => new Animated.Value(reduceMotion ? (variant === 'legendary' ? 0.35 : 0.45) : 0));
  const [flashScale] = useState(() => new Animated.Value(0.15));
  const [flashOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) return;
    const glow = glowAnimation(variant, glowScale, glowOpacity);
    const flash = variant === 'common' ? null : flashAnimation(variant, flashScale, flashOpacity);
    glow.start();
    flash?.start();
    return () => {
      glow.stop();
      flash?.stop();
    };
  }, [variant, reduceMotion, glowScale, glowOpacity, flashScale, flashOpacity]);

  useEffect(() => () => stop.current?.(), []);

  const glowColor = variant === 'common' ? GOLD.glow : variant === 'legendary' ? LEGEND.glow : PURPLE_GLOW;
  const flashSize = size * 1.3;
  return (
    <View style={{ width, height: size }}>
      <Animated.View style={[styles.layer, { width: size, height: size, left: (width - size) / 2, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`d20-glow-${variant}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={glowColor} stopOpacity={0.55} />
              <Stop offset="0.5" stopColor={glowColor} stopOpacity={0.12} />
              <Stop offset="1" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#d20-glow-${variant})`} />
        </Svg>
      </Animated.View>
      {variant !== 'common' && (
        <Animated.View
          style={[
            styles.layer,
            {
              width: flashSize,
              height: flashSize,
              left: (width - flashSize) / 2,
              top: (size - flashSize) / 2,
              borderRadius: flashSize / 2,
              backgroundColor: variant === 'legendary' ? LEGEND.flash : MERGE_FLASH,
              opacity: flashOpacity,
              transform: [{ scale: flashScale }],
            },
          ]}
        />
      )}
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={(gl) => {
          stop.current?.();
          // Erro no GL não derruba o app: a celebração segue só com a aura e os textos.
          try {
            stop.current = start(gl, variant, width, size, reduceMotion);
          } catch (error) {
            stop.current = null;
            console.warn('[D20Animation]', error);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, pointerEvents: 'none' },
});
