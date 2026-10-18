import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useRpgTheme } from '../theme';

/** Arte da logo "Dungeons & Fichas" para fundo escuro (texto claro, fundo transparente). */
const LOGO = require('../../assets/logo.webp');
/** largura / altura de assets/logo.webp. */
export const DNF_LOGO_RATIO = 1024 / 701;

export interface DnfLogoProps {
  /** Largura em px; a altura segue a proporção da arte. */
  size?: number;
  /** Entrada animada (sobe e aparece, com um leve zoom). Respeita "reduzir movimento" do sistema. */
  animated?: boolean;
  style?: StyleProp<ImageStyle>;
}

/** Logo do app: o d20 vermelho sobre "Dungeons & Fichas". */
export function DnfLogo({ size = 220, animated = true, style }: DnfLogoProps) {
  const [enter] = useState(() => new Animated.Value(animated ? 0 : 1));

  useEffect(() => {
    if (!animated) return;
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        enter.setValue(1);
        return;
      }
      running = Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.2)), useNativeDriver });
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [enter, animated]);

  return (
    <Animated.Image
      source={LOGO}
      accessibilityRole="image"
      accessibilityLabel="Dungeons & Fichas"
      resizeMode="contain"
      style={[
        { width: size, height: size / DNF_LOGO_RATIO },
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [size * 0.06, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
        style,
      ]}
    />
  );
}

export interface DnfSpinnerProps {
  /** Largura do emblema em px. Use o mesmo `imageWidth` da splash para a troca não pular. */
  size?: number;
  /** Mostra as espadas cruzadas paradas atrás do d20 (como na splash). */
  withSwords?: boolean;
  /** Texto embaixo, ex.: "Abrindo o compêndio…". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Carregamento do app: um d20 girando (com "reduzir movimento", só pulsa de leve). */
export function DnfSpinner({ size = 56, withSwords = false, label, style }: DnfSpinnerProps) {
  const theme = useRpgTheme();
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver }),
          Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        ]),
      );
      // Uma volta inteira por "rolagem", acelerando e freando como um dado de verdade.
      const roll = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver }),
      );
      running = reduce ? breathe : Animated.parallel([roll, breathe]);
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [spin, pulse]);

  return (
    <View
      style={[styles.spinner, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Carregando'}
    >
      <View style={{ width: size, height: size }}>
        {withSwords && (
          <>
            <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-45deg' }] }]}>
              <Sword color={theme.textMuted} />
            </View>
            <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '45deg' }] }]}>
              <Sword color={theme.textMuted} />
            </View>
          </>
        )}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, withSwords ? 1.06 : 1.1] }) },
              ],
            },
          ]}
        >
          <D20 color={theme.accent} fill={theme.surface} />
        </Animated.View>
      </View>
      {label ? <Text style={[styles.spinnerLabel, { color: theme.textMuted }]}>{label}</Text> : null}
    </View>
  );
}

const useNativeDriver = Platform.OS !== 'web';

/** Espada em pé, centrada em (60,60) do viewBox: a camada gira em volta do centro até cruzar. */
function Sword({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 120">
      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M60 4 L64 12 L64 90 L56 90 L56 12 Z" strokeWidth={2.5} />
        <Path d="M48 91 L72 91 M60 94 L60 105" strokeWidth={4} />
        <Circle cx="60" cy="110" r="3" strokeWidth={2.5} />
      </G>
    </Svg>
  );
}

/** d20 em traço; o preenchimento com a cor do fundo esconde o meio das espadas. */
function D20({ color, fill }: { color: string; fill: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 120">
      <G stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M60 31 L85 45.5 L85 74.5 L60 89 L35 74.5 L35 45.5 Z" fill={fill} strokeWidth={3.5} />
        <Path d="M60 42 L76 69 L44 69 Z" fill={color} fillOpacity={0.15} strokeWidth={2.5} />
        <Path
          d="M60 31 L60 42 M85 45.5 L60 42 M85 45.5 L76 69 M85 74.5 L76 69 M60 89 L76 69 M60 89 L44 69 M35 74.5 L44 69 M35 45.5 L44 69 M35 45.5 L60 42"
          fill="none"
          strokeWidth={2}
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  spinner: { alignItems: 'center', gap: 12 },
  spinnerLabel: { fontSize: 13, letterSpacing: 0.3 },
});
