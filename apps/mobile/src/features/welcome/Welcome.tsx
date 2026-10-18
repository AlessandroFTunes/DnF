import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StartSheet } from './StartSheet';
import { Button, D20, fonts, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

/** Peças que giram em volta do d20: ícones em medalhões coloridos e dados menores. */
type Token = { angle: number } & ({ icon: Icon; color: string } | { die: string; ink: string; value: number });

/** Anéis do centro para fora: raio (fração do lado do palco), volta em segundos (negativo = anti-horário) e peças. */
const ORBITS: { radius: number; period: number; tokens: Token[] }[] = [
  { radius: 0.2, period: 0, tokens: [] },
  {
    radius: 0.34,
    period: 80,
    tokens: [
      { angle: -60, icon: 'wizard-hat', color: '#8F4BC9' },
      { angle: 40, die: '#E8B417', ink: '#2B1A00', value: 20 },
      { angle: 160, icon: 'bottle-tonic-plus', color: '#3FA3B8' },
    ],
  },
  {
    radius: 0.46,
    period: -120,
    tokens: [
      { angle: -120, icon: 'sword-cross', color: '#E8822E' },
      { angle: -40, icon: 'treasure-chest', color: '#E8B417' },
      { angle: 20, icon: 'skull-outline', color: '#7FB86A' },
      { angle: 95, die: '#3FA3B8', ink: '#FFFFFF', value: 20 },
      { angle: 150, icon: 'shield-half-full', color: '#C2477E' },
      { angle: 205, icon: 'bow-arrow', color: '#4B7BE5' },
    ],
  },
  { radius: 0.68, period: 0, tokens: [] },
];

const TOKEN = 52;
const useNativeDriver = Platform.OS !== 'web';

export interface WelcomeProps {
  /** "Continuar com email" na folha de começar: abre /login, que descobre pelo email se é entrar ou criar conta. */
  onEmail: () => void;
}

/** Abertura antes do login: o d20 no centro, anéis girando com peças de RPG e o convite para começar. */
export function Welcome({ onEmail }: WelcomeProps) {
  const theme = useRpgTheme();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [textWidth, setTextWidth] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [spin] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        enter.setValue(1);
        return;
      }
      // `spin` vai de 0 a 1 em 120 s; cada anel converte isso na própria velocidade.
      running = Animated.parallel([
        Animated.timing(enter, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver }),
        Animated.loop(Animated.timing(spin, { toValue: 1, duration: 120_000, easing: Easing.linear, useNativeDriver })),
      ]);
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [spin, enter]);

  function onStageLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  }

  // Os anéis com peças cabem no palco (mesmo girando, nada passa por cima do texto); o último, só traço, vaza.
  const side = Math.min(stage.width * 1.1, stage.height - TOKEN);
  const center = { x: stage.width / 2, y: stage.height / 2 };
  const dieSize = side * 0.26;

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="welcome-glow" cx="50%" cy="38%" r="60%">
            <Stop offset="0" stopColor={theme.accent} stopOpacity={0.32} />
            <Stop offset="0.5" stopColor={theme.accent} stopOpacity={0.08} />
            <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="welcome-corner" cx="0%" cy="0%" r="70%">
            <Stop offset="0" stopColor="#8F4BC9" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#8F4BC9" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#welcome-corner)" />
        <Rect width="100%" height="100%" fill="url(#welcome-glow)" />
      </Svg>

      <SafeAreaView style={styles.safe}>
        <Animated.View
          style={[
            styles.stage,
            { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
          ]}
          onLayout={onStageLayout}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {side > 0 &&
            ORBITS.map((orbit, i) => {
              const r = side * orbit.radius;
              const turns = orbit.period ? 120 / orbit.period : 0;
              const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${turns * 360}deg`] });
              const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${-turns * 360}deg`] });
              return (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.ring,
                    {
                      width: r * 2,
                      height: r * 2,
                      borderRadius: r,
                      left: center.x - r,
                      top: center.y - r,
                      borderColor: theme.text,
                      opacity: i === ORBITS.length - 1 ? 0.06 : 0.12,
                      transform: [{ rotate }],
                    },
                  ]}
                >
                  {orbit.tokens.map((token, j) => {
                    const rad = (token.angle * Math.PI) / 180;
                    return (
                      <Animated.View
                        key={j}
                        style={[
                          styles.tokenSlot,
                          {
                            left: r + r * Math.cos(rad) - TOKEN / 2,
                            top: r + r * Math.sin(rad) - TOKEN / 2,
                            transform: [{ rotate: counter }],
                          },
                        ]}
                      >
                        <OrbitToken token={token} />
                      </Animated.View>
                    );
                  })}
                </Animated.View>
              );
            })}

          {side > 0 && (
            <D20
              size={dieSize}
              float
              shadow
              style={[styles.die, { left: center.x - dieSize / 2, top: center.y - dieSize / 2 }]}
            />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.copy,
            {
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          <View style={styles.brand}>
            <D20 size={22} value={null} />
            <Text style={[styles.brandName, { color: theme.textMuted }]}>DnF</Text>
          </View>
          <Text style={[typography.hero, styles.centered, { color: theme.text }]}>Grandes aventuras</Text>
          {textWidth > 0 && (
            <GradientText width={textWidth} from={theme.accent} to="#E8B417">
              começam aqui
            </GradientText>
          )}

          <Button label="Começar" onPress={() => setSheet(true)} style={styles.start} />
        </Animated.View>
      </SafeAreaView>

      <StartSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onEmail={() => {
          setSheet(false);
          onEmail();
        }}
      />
    </View>
  );
}

function OrbitToken({ token }: { token: Token }) {
  if ('die' in token) return <D20 size={TOKEN} value={token.value} color={token.die} numberColor={token.ink} />;
  return (
    <View
      style={[
        styles.token,
        { backgroundColor: token.color, boxShadow: `0px 0px 18px ${token.color}88` },
      ]}
    >
      <MaterialCommunityIcons name={token.icon} size={26} color="#FFFFFF" />
    </View>
  );
}

/** Texto com degradê (o RN não tem `background-clip: text`; o SVG resolve nas três plataformas). */
function GradientText({ width, from, to, children }: { width: number; from: string; to: string; children: ReactNode }) {
  const size = typography.hero.fontSize;
  return (
    <Svg width={width} height={typography.hero.lineHeight + 4} accessibilityRole="text" accessibilityLabel={String(children)}>
      <Defs>
        <LinearGradient id="welcome-title" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0.15" stopColor={from} />
          <Stop offset="0.85" stopColor={to} />
        </LinearGradient>
      </Defs>
      <SvgText
        x={width / 2}
        y={size}
        fontSize={size}
        fontFamily={fonts.displayHeavy}
        fontWeight="800"
        letterSpacing={typography.hero.letterSpacing}
        textAnchor="middle"
        fill="url(#welcome-title)"
      >
        {children}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Os anéis de fora vazam do palco: corta na borda da tela (na web, senão a página ganha rolagem).
  screen: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },
  stage: { flex: 1, overflow: 'visible' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  tokenSlot: { position: 'absolute', width: TOKEN, height: TOKEN },
  token: {
    width: TOKEN,
    height: TOKEN,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  die: { position: 'absolute' },
  copy: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  brandName: { fontFamily: fonts.displayHeavy, fontSize: 22, letterSpacing: 2 },
  centered: { textAlign: 'center' },
  start: { alignSelf: 'stretch', borderRadius: radius.pill, marginTop: spacing.xl, minHeight: 56 },
});
