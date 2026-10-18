import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { fonts, textGlow } from '@dnf/ui-react-native';
import { seeded, SKY } from './sky';

/** Caixa de cada estrela (cabe o halo maior e serve de área de toque). */
const SIZE = 56;
const C = SIZE / 2;
const LABEL_WIDTH = 120;
const HALO_MIN = 14;
const HALO_MAX = 24;
const PULSE_MS = 1200;

export interface PointProps {
  id: string;
  x: number;
  y: number;
  /** Cor da estrela acesa. */
  color: string;
  labelColor: string;
  haloColor: string;
  /** `null`: sem nome (aparece só ao tocar). */
  label: string | null;
  labelSide: 'left' | 'right';
  lit: boolean;
  glowing: boolean;
  selected: boolean;
  /** Largura da árvore (o nome não passa da borda). */
  treeWidth: number;
  accessibilityLabel: string;
  onSelect: (id: string) => void;
}

/**
 * Estrela da árvore: um `Svg` pequeno só dela. O halo de quem brilha pulsa com `Animated` (sem
 * re-renderizar nada), então a árvore só renderiza de novo quando os dados mudam.
 */
export const Point = memo(function Point(props: PointProps) {
  const { id, x, y, color, labelColor, haloColor, label, labelSide, lit, glowing, selected, treeWidth } = props;
  const on = lit || glowing;
  const right = labelSide === 'right';

  return (
    <>
      <Pressable
        onPress={() => props.onSelect(id)}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        style={[styles.box, { left: x - C, top: y - C }]}
      >
        {glowing && <Halo id={id} color={haloColor} />}
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          {on && (
            <>
              <Defs>
                <RadialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={SKY.star} stopOpacity={0.95} />
                  <Stop offset="0.35" stopColor={SKY.glow} stopOpacity={0.45} />
                  <Stop offset="1" stopColor={SKY.glow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={C} cy={C} r={selected ? 22 : 16} fill={`url(#glow-${id})`} opacity={lit ? 1 : 0.7} />
            </>
          )}
          <Circle cx={C} cy={C} r={selected ? 5 : on ? 4 : 3.2} fill={on ? color : SKY.locked} />
          {!on && (
            <Circle
              cx={C}
              cy={C}
              r={selected ? 11 : 7}
              stroke={selected ? color : SKY.locked}
              strokeOpacity={0.6}
              strokeWidth={1}
              fill="none"
            />
          )}
          {selected && <Circle cx={C} cy={C} r={11} stroke={color} strokeWidth={1.2} fill="none" />}
        </Svg>
      </Pressable>

      {label !== null && (
        <Text
          numberOfLines={2}
          style={[
            styles.label,
            {
              top: y - 9,
              left: right ? x + 14 : Math.max(4, x - 14 - LABEL_WIDTH),
              width: right ? Math.min(LABEL_WIDTH, treeWidth - x - 18) : Math.min(LABEL_WIDTH, x - 18),
              textAlign: right ? 'left' : 'right',
              color: on ? labelColor : SKY.locked,
            },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </>
  );
});

/** Anel que pulsa em volta da estrela (cada uma numa fase, para não piscarem juntas). */
function Halo({ id, color }: { id: string; color: string }) {
  const [wave] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const half = { duration: PULSE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' };
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(wave, { toValue: 1, ...half }), Animated.timing(wave, { toValue: 0, ...half })]),
    );
    const start = setTimeout(() => loop.start(), seeded(id, 5) * PULSE_MS);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [id, wave]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          pointerEvents: 'none',
          opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
          transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [HALO_MIN / HALO_MAX, 1] }) }],
        },
      ]}
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={C} cy={C} r={HALO_MAX} fill="none" stroke={color} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', width: SIZE, height: SIZE },
  label: {
    position: 'absolute',
    pointerEvents: 'none',
    fontFamily: fonts.displayMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    ...textGlow('#000', 4),
  },
});
