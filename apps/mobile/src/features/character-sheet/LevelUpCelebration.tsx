import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, radius, spacing, textGlow } from '@dnf/ui-react-native';

/** O que o personagem ganhou ao subir (aparece um por um na celebração). */
export interface LevelUpGain {
  label: string;
  kind: 'feature' | 'subclass' | 'asi' | 'hp';
}

/** Cores do dado: arestas/brilhos (`edge`), aura (`glow`) e clarão da quebra (`flash`). */
export interface DicePalette {
  edge: string;
  glow: string;
  flash: string;
}

/** Subida de nível comum. */
export const GOLD_DIE: DicePalette = { edge: '#FFD9A0', glow: '#FFB45C', flash: '#FFF6DD' };
/** Nível 20 (herói lendário). */
export const PURPLE_DIE: DicePalette = { edge: '#D9C2FF', glow: '#9B5CFF', flash: '#F1E8FF' };
const TEXT = '#F3EBDD';
const MUTED = '#9AA0BE';

const GAIN_ICON: Record<LevelUpGain['kind'], 'star-four-points' | 'source-branch' | 'arm-flex' | 'heart-plus'> = {
  feature: 'star-four-points',
  subclass: 'source-branch',
  asi: 'arm-flex',
  hp: 'heart-plus',
};

// ---------------------------------------------------------------------------
// d20 em arame: icosaedro (12 vértices, 30 arestas)

type Vec3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;
const VERTICES: Vec3[] = [
  ...[-1, 1].flatMap((a) => [-PHI, PHI].map((b) => [0, a, b] as Vec3)),
  ...[-1, 1].flatMap((a) => [-PHI, PHI].map((b) => [a, b, 0] as Vec3)),
  ...[-PHI, PHI].flatMap((a) => [-1, 1].map((b) => [a, 0, b] as Vec3)),
];
/** Vértices vizinhos ficam a distância 2 (os outros pares são diagonais). */
const EDGES: [number, number][] = VERTICES.flatMap((a, i) =>
  VERTICES.slice(i + 1).flatMap((b, k) => {
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    return Math.abs(d - 4) < 1e-6 ? [[i, i + 1 + k] as [number, number]] : [];
  }),
);
const RADIUS = Math.sqrt(1 + PHI * PHI);

function rotate([x, y, z]: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

// ---------------------------------------------------------------------------
// Linha do tempo (ms)

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Progresso de 0 a 1 entre dois instantes. */
const phase = (t: number, start: number, length: number) => clamp01((t - start) / length);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Passa um pouco do tamanho final e volta (o dado "pousa"). */
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

const APPEAR_MS = 750;
const BURST_AT = 600;
const TITLE_AT = 950;
const GAINS_AT = 1350;
const GAIN_STEP_MS = 160;
/** No nível 20 o personagem vira herói lendário (a ficha fica branca e dourada) e o dado se quebra. */
const LEGENDARY_LEVEL = 20;
/** Herói lendário: o dado treme, quebra e "HERÓI LENDÁRIO" sai de dentro dele. */
const SHAKE_AT = 1000;
const SHATTER_AT = 1800;
const SHATTER_MS = 1100;

/** Número fixo por aresta (direção e giro dos estilhaços sempre iguais). */
const fixed = (i: number, n: number) => (((i + 1) * 9301 + n * 49297) % 233280) / 233280;

/** Multiclasse: um d20 vermelho e um azul se chocam e viram um roxo ("nova trilha"). */
const RED = '#FF5A4E';
const BLUE = '#5AA8FF';
const PURPLE = '#C08CFF';
const PURPLE_GLOW = '#9B5CFF';
const COLLIDE_AT = 950;

/** d20 em arame num ponto qualquer do SVG (usado pelos dados da multiclasse). */
function wireDie(key: string, cx: number, cy: number, radius: number, yaw: number, pitch: number, color: string, alpha: number) {
  const points = VERTICES.map((v) => {
    const [x, y, z] = rotate(v, yaw, pitch);
    const k = (radius / RADIUS) * (4.2 / (4.2 - z));
    return { x: cx + x * k, y: cy + y * k, z };
  });
  return [
    ...EDGES.map(([a, b], i) => {
      const pa = points[a]!;
      const pb = points[b]!;
      const depth = ((pa.z + pb.z) / 2 / RADIUS + 1) / 2;
      return (
        <Line
          key={`${key}-e${i}`}
          x1={pa.x}
          y1={pa.y}
          x2={pb.x}
          y2={pb.y}
          stroke={color}
          strokeWidth={0.6 + depth * 0.8}
          strokeOpacity={(0.18 + depth * 0.82) * alpha}
        />
      );
    }),
    ...points.map((pt, i) => (
      <Circle key={`${key}-v${i}`} cx={pt.x} cy={pt.y} r={1.4} fill={color} opacity={(((pt.z / RADIUS + 1) / 2) * 0.9 + 0.1) * alpha} />
    )),
  ];
}

/** Brilhos que estouram do dado quando ele pousa (posições fixas, sem sorteio a cada quadro). */
const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + ((i * 7) % 5) * 0.11;
  return { angle, reach: 0.75 + ((i * 13) % 7) / 10, size: 1 + ((i * 5) % 3) * 0.7 };
});

/**
 * Celebração de subir de nível: um d20 transparente de arestas finas gira e pousa, e aparece o que o
 * personagem ganhou. Ao entrar numa classe nova (`multiclass`), dois d20, um vermelho e um azul, se chocam e
 * viram um roxo: "nova trilha alcançada".
 */
export function LevelUpCelebration({
  level,
  gains,
  multiclass = false,
  onClose,
}: {
  level: number;
  gains: LevelUpGain[];
  multiclass?: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Um quadro por vez enquanto a celebração está aberta (o dado segue girando devagar).
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      setElapsed(Date.now() - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Com "reduzir movimento", tudo já aparece no lugar.
  const t = reduceMotion ? 60_000 : elapsed;
  const legendary = level >= LEGENDARY_LEVEL;
  // No nível 20 a lenda tem prioridade sobre a multiclasse.
  const merge = multiclass && !legendary;
  const titleAt = legendary ? SHATTER_AT + 450 : merge ? COLLIDE_AT + 450 : TITLE_AT;
  const gainsAt = legendary ? SHATTER_AT + 850 : merge ? COLLIDE_AT + 850 : GAINS_AT;
  const done = t >= gainsAt + gains.length * GAIN_STEP_MS;

  const size = Math.min(width * 0.62, height * 0.36, 280);
  const center = size / 2;
  // A curva com "quique" pode dar um resíduo negativo no início (-3e-14): raio negativo é inválido no SVG.
  const scale = Math.max(0, easeOutBack(phase(t, 0, APPEAR_MS)));
  // Gira rápido ao surgir e desacelera até um giro lento contínuo (ao quebrar, o giro para onde estava).
  const spinT = legendary ? Math.min(t, SHATTER_AT) : t;
  const yaw = reduceMotion ? 0.6 : spinT * 0.0006 + 7 * (1 - Math.exp(-spinT / 420));
  const pitch = reduceMotion ? 0.35 : 0.35 + Math.sin(spinT / 1400) * 0.18 + 2.2 * Math.exp(-spinT / 380);

  // Lendário: antes de quebrar, o dado treme cada vez mais forte.
  const shake = legendary && t < SHATTER_AT ? phase(t, SHAKE_AT, SHATTER_AT - SHAKE_AT) ** 2 * 5 : 0;
  const shakeX = Math.sin(t * 0.11) * shake;
  const shakeY = Math.cos(t * 0.137) * shake;

  const projected = VERTICES.map((v) => {
    const [x, y, z] = rotate(v, yaw, pitch);
    const perspective = 4.2 / (4.2 - z);
    const s = ((size * 0.42) / RADIUS) * perspective * scale;
    return { x: center + x * s + shakeX, y: center + y * s + shakeY, z };
  });

  const shatter = legendary ? phase(t, SHATTER_AT, SHATTER_MS) : 0;
  const broken = shatter > 0;
  const flash = legendary ? phase(t, SHATTER_AT, 520) : 0;
  const burst = phase(t, legendary ? SHATTER_AT : BURST_AT, 900);
  const glow = legendary
    ? 0.35 + 0.65 * phase(t, SHAKE_AT, SHATTER_AT - SHAKE_AT) * (1 - easeOut(shatter))
    : 0.35 + 0.25 * Math.sin(t / 500) + 0.4 * (1 - easeOut(phase(t, BURST_AT, 700)));
  const numberIn = legendary ? 0 : easeOut(phase(t, BURST_AT + 150, 450));
  // "HERÓI LENDÁRIO" nasce do centro do dado quebrado e cresce até o tamanho dele.
  const heroIn = legendary ? phase(t, SHATTER_AT + 60, 700) : 0;
  const titleIn = easeOut(phase(t, titleAt, 450));
  const backdrop = easeOut(phase(t, 0, 400));

  // Multiclasse: os dois dados entram pelos lados, acelerando e girando, e se chocam no centro; do choque
  // nasce o roxo, que pousa e segue girando devagar.
  const stageWidth = merge ? Math.min(width - spacing.xl * 2, size * 2.4) : size;
  const mid = stageWidth / 2;
  const approach = phase(t, 0, COLLIDE_AT) ** 2;
  const collided = t >= COLLIDE_AT;
  const incoming = 1 - phase(t, COLLIDE_AT, 140);
  const travel = (stageWidth / 2 + size * 0.2) * (1 - approach) + size * 0.16;
  const born = Math.max(0, easeOutBack(phase(t, COLLIDE_AT, 650)));
  const mergeFlash = phase(t, COLLIDE_AT, 560);
  const mergeBurst = phase(t, COLLIDE_AT, 900);
  const sinceBorn = Math.max(0, t - COLLIDE_AT);
  const purpleYaw = reduceMotion ? 0.6 : sinceBorn * 0.0006 + 5 * (1 - Math.exp(-sinceBorn / 420));
  const purplePitch = reduceMotion ? 0.35 : 0.35 + Math.sin(sinceBorn / 1400) * 0.18 + 1.6 * Math.exp(-sinceBorn / 380);
  const mergeNumber = easeOut(phase(t, COLLIDE_AT + 200, 450));

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={[styles.backdrop, { opacity: backdrop }]}
        onPress={() => done && onClose()}
        accessibilityLabel="Fechar celebração"
      >
        {merge ? (
          <View style={{ width: stageWidth, height: size }}>
            <Svg width={stageWidth} height={size}>
              <Defs>
                <RadialGradient id="d20-glow-merge" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={PURPLE_GLOW} stopOpacity={0.6} />
                  <Stop offset="0.5" stopColor={PURPLE_GLOW} stopOpacity={0.14} />
                  <Stop offset="1" stopColor={PURPLE_GLOW} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {/* Gradiente com raio 0 derruba o Android: só desenha depois que o roxo nasce. */}
              {born > 0 && (
                <Circle cx={mid} cy={center} r={(size / 2) * born} fill="url(#d20-glow-merge)" opacity={0.45 + 0.2 * Math.sin(t / 500)} />
              )}
              {incoming > 0 && [
                ...wireDie('red', mid - travel, center, size * 0.3, t * 0.012, 0.4 + t * 0.004, RED, incoming),
                ...wireDie('blue', mid + travel, center, size * 0.3, -t * 0.011, 0.7 - t * 0.005, BLUE, incoming),
              ]}
              {/* Choque: clarão e faíscas vermelhas e azuis que viram roxas. */}
              {mergeFlash > 0 && mergeFlash < 1 && (
                <Circle cx={mid} cy={center} r={size * (0.1 + 0.55 * easeOut(mergeFlash))} fill="#F1E4FF" opacity={0.9 * (1 - mergeFlash)} />
              )}
              {collided &&
                SPARKS.map((spark, i) => {
                  const r = size * 0.1 + easeOut(mergeBurst) * size * 0.5 * spark.reach;
                  const color = mergeBurst < 0.35 ? (i % 2 ? RED : BLUE) : PURPLE;
                  return (
                    <Circle
                      key={`m-${i}`}
                      cx={mid + Math.cos(spark.angle) * r}
                      cy={center + Math.sin(spark.angle) * r}
                      r={spark.size}
                      fill={color}
                      opacity={mergeBurst < 1 ? 1 - mergeBurst : 0}
                    />
                  );
                })}
              {born > 0 && wireDie('purple', mid, center, size * 0.42 * born, purpleYaw, purplePitch, PURPLE, clamp01(born))}
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
              <Text style={[styles.levelNumber, styles.mergeNumber, { opacity: mergeNumber, transform: [{ scale: 0.6 + 0.4 * mergeNumber }] }]}>
                {level}
              </Text>
            </View>
          </View>
        ) : (
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="d20-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={GLOW} stopOpacity={0.55} />
                <Stop offset="0.5" stopColor={GLOW} stopOpacity={0.12} />
                <Stop offset="1" stopColor={GLOW} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* No Android, gradiente com raio 0 derruba o app (o primeiro quadro tem scale 0). */}
            {scale > 0 && <Circle cx={center} cy={center} r={(size / 2) * scale} fill="url(#d20-glow)" opacity={glow} />}

            {SPARKS.map((spark, i) => {
              const r = size * 0.18 + easeOut(burst) * size * 0.42 * spark.reach;
              return (
                <Circle
                  key={i}
                  cx={center + Math.cos(spark.angle) * r}
                  cy={center + Math.sin(spark.angle) * r}
                  r={spark.size}
                  fill={EDGE}
                  opacity={burst > 0 && burst < 1 ? 1 - burst : 0}
                />
              );
            })}

            {/* Clarão da quebra */}
            {flash > 0 && flash < 1 && (
              <Circle cx={center} cy={center} r={size * (0.12 + 0.5 * easeOut(flash))} fill={palette.flash} opacity={0.9 * (1 - flash)} />
            )}

            {/* Arestas de trás mais apagadas: o dado é transparente, dá para ver através dele. Ao quebrar,
                cada aresta vira um estilhaço que voa para fora girando e some. */}
            {EDGES.map(([a, b], i) => {
              const pa = projected[a]!;
              const pb = projected[b]!;
              const depth = ((pa.z + pb.z) / 2 / RADIUS + 1) / 2;
              let [x1, y1, x2, y2] = [pa.x, pa.y, pb.x, pb.y];
              if (broken) {
                const p = easeOut(shatter);
                const mx = (pa.x + pb.x) / 2;
                const my = (pa.y + pb.y) / 2;
                const angle = Math.atan2(my - center, mx - center) + (fixed(i, 1) - 0.5) * 0.6;
                const fly = p * size * (0.45 + 0.5 * fixed(i, 2));
                const cx = mx + Math.cos(angle) * fly;
                const cy = my + Math.sin(angle) * fly + shatter * shatter * size * 0.18;
                const spin = p * (fixed(i, 3) - 0.5) * 7;
                const half = Math.hypot(pb.x - pa.x, pb.y - pa.y) / 2 * (1 - 0.4 * p);
                const dir = Math.atan2(pb.y - pa.y, pb.x - pa.x) + spin;
                [x1, y1, x2, y2] = [cx - Math.cos(dir) * half, cy - Math.sin(dir) * half, cx + Math.cos(dir) * half, cy + Math.sin(dir) * half];
              }
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={EDGE}
                  strokeWidth={broken ? 1.6 : 0.6 + depth * 0.8}
                  strokeOpacity={broken ? 1 - shatter : (0.18 + depth * 0.82) * clamp01(scale)}
                />
              );
            })}
            {!broken &&
              projected.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={1.4} fill={EDGE} opacity={(((p.z / RADIUS + 1) / 2) * 0.9 + 0.1) * clamp01(scale)} />
              ))}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
            {legendary ? (
              <Text
                style={[
                  styles.hero,
                  { color: EDGE, ...textGlow(GLOW, 18) },
                  { opacity: clamp01(heroIn * 1.6), transform: [{ scale: 0.15 + 0.85 * easeOutBack(heroIn) }] },
                ]}
              >
                {'HERÓI\nLENDÁRIO'}
              </Text>
            ) : (
              <Text style={[styles.levelNumber, textGlow(GLOW, 16), { opacity: numberIn, transform: [{ scale: 0.6 + 0.4 * numberIn }] }]}>
                {level}
              </Text>
            )}
          </View>
        </View>
        )}

        <View style={[styles.text, { opacity: titleIn, transform: [{ translateY: (1 - titleIn) * 16 }] }]}>
          <Text style={[styles.overline, merge && styles.mergeOverline]}>
            {legendary ? 'Lenda alcançada' : merge ? 'Nova trilha alcançada' : 'Novo nível alcançado'}
          </Text>
          <Text style={styles.title}>Nível {level}</Text>
          {gains.length > 0 && <Text style={styles.youGot}>Você ganhou:</Text>}
          {gains.map((gain, i) => {
            const show = easeOut(phase(t, gainsAt + i * GAIN_STEP_MS, 380));
            return (
              <View key={`${gain.kind}-${gain.label}`} style={[styles.gain, { opacity: show, transform: [{ translateY: (1 - show) * 10 }] }]}>
                <MaterialCommunityIcons name={GAIN_ICON[gain.kind]} size={16} color={EDGE} />
                <Text style={styles.gainText}>{gain.label}</Text>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={onClose}
          disabled={!done}
          accessibilityRole="button"
          style={[styles.button, { borderColor: EDGE, opacity: done ? 1 : 0 }]}
        >
          <Text style={[styles.buttonText, { color: EDGE }]}>Continuar</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,5,12,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  levelNumber: {
    color: TEXT,
    fontFamily: fonts.displayHeavy,
    fontSize: 44,
  },
  hero: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 2,
    textAlign: 'center',
  },
  mergeNumber: { ...textGlow(PURPLE_GLOW, 16) },
  mergeOverline: { color: PURPLE },
  text: { alignItems: 'center', gap: spacing.xs, maxWidth: 420 },
  overline: { fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },
  title: { color: TEXT, fontFamily: fonts.display, fontSize: 30, letterSpacing: 1 },
  youGot: { color: MUTED, fontSize: 13, letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.xs },
  gain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gainText: { color: TEXT, fontFamily: fonts.displayMedium, fontSize: 17, letterSpacing: 0.5, textAlign: 'center' },
  button: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  buttonText: { fontFamily: fonts.displayMedium, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' },
});
