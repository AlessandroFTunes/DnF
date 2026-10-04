import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useRpgTheme } from '../theme';

export interface DnfLogoProps {
  /** Largura do emblema em px; o nome embaixo acompanha a escala. */
  size?: number;
  /** Mostra "DnF" embaixo do emblema. */
  showName?: boolean;
  /** Entrada animada (d20 rola, espadas cruzam, nome sobe). Respeita "reduzir movimento" do sistema. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Emblema do DnF: d20 em traço sobre duas espadas cruzadas, nas cores do tema. */
export function DnfLogo({ size = 120, showName = true, animated = true, style }: DnfLogoProps) {
  const theme = useRpgTheme();
  const a = useRef({
    d20: new Animated.Value(0),
    swords: new Animated.Value(0),
    name: new Animated.Value(0),
  }).current;

  useEffect(() => {
    const all = [a.d20, a.swords, a.name];
    if (!animated) {
      all.forEach((v) => v.setValue(1));
      return;
    }

    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        all.forEach((v) => v.setValue(1));
        return;
      }
      running = Animated.sequence([
        Animated.timing(a.d20, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver }),
        Animated.parallel([
          Animated.spring(a.swords, { toValue: 1, friction: 5, tension: 60, useNativeDriver }),
          Animated.timing(a.name, {
            toValue: 1,
            duration: 450,
            delay: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ]),
      ]);
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [a, animated]);

  const sword = (angle: number) => ({
    opacity: a.swords.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
    transform: [{ rotate: a.swords.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${angle}deg`] }) }],
  });

  return (
    <View style={[styles.root, style]} accessible accessibilityRole="image" accessibilityLabel="DnF">
      <View style={{ width: size, height: size }}>
        <Animated.View style={[StyleSheet.absoluteFill, sword(-45)]}>
          <Sword color={theme.textMuted} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, sword(45)]}>
          <Sword color={theme.textMuted} />
        </Animated.View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: a.d20.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [
                { rotate: a.d20.interpolate({ inputRange: [0, 1], outputRange: ['-240deg', '0deg'] }) },
                { scale: a.d20.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            },
          ]}
        >
          <D20 color={theme.accent} fill={theme.surface} />
        </Animated.View>
      </View>

      {showName && (
        <Animated.Text
          style={[
            styles.name,
            {
              color: theme.accent,
              fontSize: size * 0.3,
              letterSpacing: size * 0.06,
              opacity: a.name,
              transform: [{ translateY: a.name.interpolate({ inputRange: [0, 1], outputRange: [size * 0.08, 0] }) }],
            },
          ]}
        >
          DnF
        </Animated.Text>
      )}
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
  root: { alignItems: 'center' },
  name: { fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontWeight: '700' },
});
