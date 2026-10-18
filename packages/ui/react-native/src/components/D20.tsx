import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fonts, mixColor, useRpgTheme } from '../theme';

export interface D20Props {
  /** Largura em px (o dado é quadrado). */
  size?: number;
  /** Número na face da frente. `null` deixa a face lisa. Com 20, as faces vizinhas mostram 2, 8 e 14 como num dado real. */
  value?: number | string | null;
  /** Cor do material do dado (#RRGGBB). Padrão: `accent` do tema. */
  color?: string;
  /** Cor do número. Padrão: `text` do tema. */
  numberColor?: string;
  /** Sombra no "chão" embaixo do dado. */
  shadow?: boolean;
  /** Flutua devagar, balançando de leve. Com "reduzir movimento" do sistema, fica parado. */
  float?: boolean;
  style?: StyleProp<ViewStyle>;
}

/*
 * Geometria (viewBox 100×100): o icosaedro visto de frente, com uma face virada para quem olha.
 * O contorno é um hexágono; o triângulo do meio é a face da frente e as outras nove a cercam.
 */
type Point = readonly [number, number];
const T: Point = [50, 3];
const UR: Point = [88.1, 25];
const LR: Point = [88.1, 69];
const B: Point = [50, 91];
const LL: Point = [11.9, 69];
const UL: Point = [11.9, 25];
const A: Point = [50, 23.6];
const BR: Point = [71.1, 60.1];
const BL: Point = [28.9, 60.1];

const FRONT: Point[] = [A, BR, BL];

/** Faces visíveis e quanto cada uma pega da luz, que vem do alto à esquerda (+ clareia, − escurece). */
const FACES: { points: Point[]; light: number }[] = [
  { points: FRONT, light: 0.12 },
  { points: [T, A, UL], light: 0.38 },
  { points: [T, UR, A], light: 0.06 },
  { points: [UR, BR, A], light: -0.12 },
  { points: [UR, LR, BR], light: -0.36 },
  { points: [LR, B, BR], light: -0.5 },
  { points: [B, BL, BR], light: -0.3 },
  { points: [B, LL, BL], light: -0.18 },
  { points: [LL, UL, BL], light: 0.08 },
  { points: [UL, A, BL], light: 0.24 },
];

/** Faces vizinhas da frente, com o número de cada uma num d20 de verdade (vizinhas do 20). */
const NEIGHBORS: { points: Point[]; label: string; angle: number }[] = [
  { points: [UR, BR, A], label: '14', angle: 60 },
  { points: [B, BL, BR], label: '2', angle: 180 },
  { points: [UL, A, BL], label: '8', angle: -60 },
];

const HEXAGON = path([T, UR, LR, B, LL, UL]);
const INNER_EDGES = [
  [A, BR], [BR, BL], [BL, A],
  [T, A], [UR, A], [UR, BR], [LR, BR], [B, BR], [B, BL], [LL, BL], [UL, BL], [UL, A],
] as const;

function path(points: readonly Point[]): string {
  return `M${points.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
}

function centroid(points: readonly Point[]): Point {
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
}

/** Clareia (t > 0) ou escurece (t < 0) uma cor #RRGGBB. */
function shade(color: string, t: number): string {
  return t >= 0 ? mixColor(color, '#FFFFFF', t) : mixColor(color, '#000000', -t);
}

const useNativeDriver = Platform.OS !== 'web';

/** Dado de vinte faces desenhado em SVG: faces sombreadas, arestas com brilho e o número gravado na frente. */
export function D20({ size = 96, value = 20, color, numberColor, shadow = false, float = false, style }: D20Props) {
  const theme = useRpgTheme();
  const base = color ?? theme.accent;
  const ink = numberColor ?? theme.text;
  // Os ids dos gradientes precisam ser únicos por dado (vários na mesma tela); ":" quebra o url(#…) na web.
  const id = `d20${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [motion] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!float) return;
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      const half = { duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver };
      running = Animated.loop(
        Animated.sequence([Animated.timing(motion, { toValue: 1, ...half }), Animated.timing(motion, { toValue: 0, ...half })]),
      );
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
      motion.setValue(0);
    };
  }, [float, motion]);

  const text = value === null || value === undefined ? null : String(value);
  const showNeighbors = text === '20';
  const numberSize = text && text.length > 1 ? 15 : 18;
  const [cx, cy] = centroid(FRONT);

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={text ? `d20 mostrando ${text}` : 'd20'}
    >
      {shadow && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }),
              transform: [{ scaleX: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }],
            },
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`${id}-floor`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={theme.shadow} stopOpacity={0.55} />
                <Stop offset="0.6" stopColor={shade(base, -0.6)} stopOpacity={0.25} />
                <Stop offset="1" stopColor={theme.shadow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={96} rx={32} ry={3.6} fill={`url(#${id}-floor)`} />
          </Svg>
        </Animated.View>
      )}

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.05] }) },
              { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
            ],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            {/* Cada face tem seu tom e um degradê leve na direção da luz, para não parecer chapada. */}
            {FACES.map((face, i) => (
              <LinearGradient key={i} id={`${id}-f${i}`} x1="12" y1="3" x2="88" y2="91" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={shade(base, face.light + 0.1)} />
                <Stop offset="1" stopColor={shade(base, face.light - 0.1)} />
              </LinearGradient>
            ))}
            <RadialGradient id={`${id}-shine`} cx="34" cy="22" r="34" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.08} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}-depth`} x1="50" y1="3" x2="50" y2="91" gradientUnits="userSpaceOnUse">
              <Stop offset="0.55" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.28} />
            </LinearGradient>
            <ClipPath id={`${id}-clip`}>
              <Path d={HEXAGON} />
            </ClipPath>
          </Defs>

          {/* Faces */}
          {FACES.map((face, i) => (
            <Path key={i} d={path(face.points)} fill={`url(#${id}-f${i})`} />
          ))}

          {/* Luz: brilho no alto à esquerda e sombra que cresce para baixo. */}
          <G clipPath={`url(#${id}-clip)`}>
            <Path d={HEXAGON} fill={`url(#${id}-depth)`} />
            <Ellipse cx={34} cy={22} rx={34} ry={30} fill={`url(#${id}-shine)`} />
          </G>

          {/* Arestas: linha escura de fundo + fio claro, como uma quina chanfrada. */}
          <G fill="none" strokeLinecap="round">
            {INNER_EDGES.map(([p, q], i) => (
              <Path key={`d${i}`} d={`M${p[0]} ${p[1]} L${q[0]} ${q[1]}`} stroke={shade(base, -0.55)} strokeOpacity={0.35} strokeWidth={1.6} />
            ))}
            {INNER_EDGES.map(([p, q], i) => (
              <Path key={`l${i}`} d={`M${p[0]} ${p[1]} L${q[0]} ${q[1]}`} stroke={shade(base, 0.55)} strokeOpacity={0.55} strokeWidth={0.6} />
            ))}
          </G>

          {/* Números das faces vizinhas, menores e achatados pela inclinação. */}
          {showNeighbors &&
            NEIGHBORS.map((face) => {
              const [x, y] = centroid(face.points);
              return (
                <G key={face.label} transform={`translate(${x} ${y}) rotate(${face.angle}) scale(1 0.72)`} opacity={0.6}>
                  <SvgText
                    y={2.6}
                    fontSize={7.5}
                    fontFamily={fonts.displayHeavy}
                    fontWeight="800"
                    textAnchor="middle"
                    fill={ink}
                  >
                    {face.label}
                  </SvgText>
                </G>
              );
            })}

          {/* Número da frente, gravado: sombra por baixo e luz por cima. */}
          {text && (
            <G>
              <SvgText
                x={cx + 0.5}
                y={cy + numberSize * 0.36 + 0.8}
                fontSize={numberSize}
                fontFamily={fonts.displayHeavy}
                fontWeight="800"
                textAnchor="middle"
                fill="#000000"
                fillOpacity={0.45}
              >
                {text}
              </SvgText>
              <SvgText
                x={cx}
                y={cy + numberSize * 0.36}
                fontSize={numberSize}
                fontFamily={fonts.displayHeavy}
                fontWeight="800"
                textAnchor="middle"
                fill={ink}
                stroke={shade(base, 0.7)}
                strokeOpacity={0.35}
                strokeWidth={0.3}
              >
                {text}
              </SvgText>
            </G>
          )}

          {/* Contorno: borda escura e um fio de luz nas quinas de cima. */}
          <Path d={HEXAGON} fill="none" stroke={shade(base, -0.62)} strokeWidth={1.6} strokeLinejoin="round" />
          <Path
            d={`M${LL[0]} ${LL[1]} L${UL[0]} ${UL[1]} L${T[0]} ${T[1]} L${UR[0]} ${UR[1]}`}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.45}
            strokeWidth={0.7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
