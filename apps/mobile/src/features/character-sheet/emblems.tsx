import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { fonts, useRpgTheme } from '@dnf/ui-react-native';

/** Formas dos emblemas, desenhadas num quadro de 100×100. `cy` é a altura (no quadro) onde o número fica centrado. */
export type EmblemShape = 'shield' | 'boot' | 'star' | 'd20' | 'stopwatch' | 'eye';

const CENTER: Record<EmblemShape, number> = { shield: 46, boot: 56, star: 50, d20: 56, stopwatch: 58, eye: 52 };

function ShapeArt({ shape, fill, stroke }: { shape: EmblemShape; fill: string; stroke: string }): ReactNode {
  const line = { stroke, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (shape) {
    case 'shield':
      return (
        <G>
          <Path d="M50 4 L90 16 V44 C90 70 73 87 50 96 C27 87 10 70 10 44 V16 Z" fill={fill} {...line} />
          <Path d="M50 13 L81 22 V44 C81 64 68 78 50 86" fill="none" {...line} strokeWidth={2} strokeOpacity={0.5} />
        </G>
      );
    case 'boot':
      // Bota de lado, bico para a direita: cano com a dobra em cima e sola com salto.
      return (
        <G>
          <Path d="M24 16 H58 V50 C66 55 80 59 88 63 C95 67 96 74 96 78 V84 H24 Z" fill={fill} {...line} />
          <Path d="M18 5 H64 V17 H18 Z" fill={fill} {...line} />
          <Path d="M24 84 H96 V91 H50 V95 H24 Z" fill={stroke} {...line} />
        </G>
      );
    case 'star':
      return <Path d="M50 2 L64 36 L98 50 L64 64 L50 98 L36 64 L2 50 L36 36 Z" fill={fill} {...line} />;
    case 'd20':
      // Dado de 20 faces visto de frente: hexágono com o triângulo central.
      return (
        <G>
          <Path d="M50 4 L91 27 V73 L50 96 L9 73 V27 Z" fill={fill} {...line} />
          <Path d="M50 22 L77 70 H23 Z" fill="none" {...line} strokeWidth={2.5} />
          <Path d="M50 4 V22 M91 27 L77 70 M9 27 L23 70 M91 27 L50 22 L9 27 M77 70 L91 73 M23 70 L9 73 M77 70 L50 96 L23 70" fill="none" {...line} strokeWidth={1.5} strokeOpacity={0.55} />
        </G>
      );
    case 'stopwatch':
      return (
        <G>
          <Rect x={42} y={2} width={16} height={9} rx={2} fill={stroke} />
          <Path d="M78 22 L86 14" fill="none" {...line} />
          <Circle cx={50} cy={58} r={38} fill={fill} {...line} />
        </G>
      );
    case 'eye':
      return (
        <G>
          <Path d="M3 52 C20 22 80 22 97 52 C80 82 20 82 3 52 Z" fill={fill} {...line} />
          <Circle cx={50} cy={52} r={23} fill={fill} {...line} strokeWidth={3} />
        </G>
      );
  }
}

/** Número dentro de uma forma (escudo da CA, bota do deslocamento…). */
export function Emblem({
  shape,
  value,
  size = 68,
  accent,
}: {
  shape: EmblemShape;
  value: string;
  size?: number;
  accent?: boolean;
}) {
  const theme = useRpgTheme();
  // Números longos (20/20, +10) encolhem para caber na forma.
  const fontSize = Math.round(size * (value.length > 3 ? 0.2 : value.length > 2 ? 0.25 : 0.3));
  const lineHeight = Math.round(fontSize * 1.3);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <ShapeArt shape={shape} fill={accent ? theme.accentSoft : theme.goldSoft} stroke={accent ? theme.accent : theme.gold} />
      </Svg>
      <Text
        style={[
          styles.value,
          { top: (CENTER[shape] / 100) * size - lineHeight / 2, fontSize, lineHeight, color: accent ? theme.accent : theme.text },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const HEART = 'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';
const HALF_LEFT = 'M50 20 C46 13 39 8 30 8 C17 8 6 18 6 32 C6 50 20 66 50 88 L53 73 L45 60 L55 46 L44 33 Z';
const HALF_RIGHT = 'M50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 L53 73 L45 60 L55 46 L44 33 Z';

/** Rachaduras de cada etapa (75%, 50%, 25%): cada uma acrescenta à anterior. */
const CRACKS = [
  'M50 20 L44 33 L51 41',
  'M51 41 L55 46 L45 60 M44 33 L33 30',
  'M45 60 L53 73 L50 88 M55 46 L68 44 M45 60 L34 64',
];

/**
 * Coração que vai rachando com a vida: inteiro acima de 75%, uma rachadura até 75%, mais até 50%, quase partido até 25%
 * e quebrado em dois (cinza) a 0.
 */
export function HeartGauge({ current, max, size = 52 }: { current: number; max: number; size?: number }) {
  const theme = useRpgTheme();
  const ratio = max > 0 ? current / max : 0;
  const stage = ratio > 0.75 ? 0 : ratio > 0.5 ? 1 : ratio > 0.25 ? 2 : ratio > 0 ? 3 : 4;
  const label = ['inteiro', 'rachado', 'muito rachado', 'quase partido', 'partido'][stage];

  return (
    <View accessible accessibilityLabel={`Coração ${label}`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {stage === 4 ? (
          <G opacity={0.8} transform="translate(50 50) scale(0.85) translate(-50 -50)">
            <Path d={HALF_LEFT} fill={theme.textMuted} transform="translate(-7 6) rotate(-10 50 88)" />
            <Path d={HALF_RIGHT} fill={theme.textMuted} transform="translate(7 6) rotate(10 50 88)" />
          </G>
        ) : (
          <G>
            <Path d={HEART} fill={theme.negative} />
            {stage === 0 && <Path d="M24 22 C18 24 15 30 15 35" fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" />}
            {CRACKS.slice(0, stage).map((d) => (
              <Path key={d} d={d} fill="none" stroke={theme.surfaceRaised} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.displayHeavy },
});
