import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_800ExtraBold } from '@expo-google-fonts/cinzel';
import { fonts, typography, useRpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../hooks/hook.session';
import { prefetchSrd } from '../lib/srd';

// A splash nativa fica até o primeiro quadro do app; o compêndio começa a abrir já aqui, durante ela.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
const compendiumReady = prefetchSrd();

/** Mesmo `imageWidth` e imagem da splash (app.json): a troca da splash para a animação não pula. */
const SPLASH_IMAGE_WIDTH = 200;
const SPLASH_IMAGE = require('../../assets/splash-icon-dark.png');

export default function RootLayout() {
  const { status } = useSession();
  const theme = useRpgTheme();
  // As chaves precisam bater com `fonts` do tema (@dnf/ui-react-native).
  const [fontsLoaded, fontError] = useFonts({ Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_800ExtraBold });
  const [compendium, setCompendium] = useState(false);

  useEffect(() => {
    let active = true;
    void compendiumReady.then(() => active && setCompendium(true));
    // O primeiro quadro (a tela de abertura) já está desenhado: troca a splash nativa pela animação.
    SplashScreen.hide();
    return () => {
      active = false;
    };
  }, []);

  // Até ler o token do Keychain, carregar as fontes e abrir o compêndio, fica a tela de abertura.
  if (status === 'loading' || (!fontsLoaded && !fontError) || !compendium) {
    return (
      <View style={[styles.opening, { backgroundColor: theme.surface }]}>
        <OpeningDie />
        <Text style={[typography.caption, styles.openingLabel, { color: theme.textMuted }]}>Abrindo o compêndio…</Text>
      </View>
    );
  }

  const signedIn = status === 'signedIn';
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.accent,
          headerTitleStyle: { color: theme.text, fontFamily: fonts.display },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.surface },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          {/* A primeira tela liberada é para onde o app vai ao deslogar: a abertura vem antes do formulário. */}
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="character/new" options={{ headerShown: false }} />
          <Stack.Screen name="character/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/index" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="mesa/join" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

/** O dado da splash, no mesmo lugar e tamanho, respirando e balançando de leve enquanto o app abre. */
function OpeningDie() {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      const half = { duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' };
      running = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 1, ...half }), Animated.timing(t, { toValue: 0, ...half })]));
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [t]);

  return (
    <Animated.Image
      source={SPLASH_IMAGE}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      style={{
        width: SPLASH_IMAGE_WIDTH,
        height: SPLASH_IMAGE_WIDTH,
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
      }}
    />
  );
}

const styles = StyleSheet.create({
  // O emblema fica exatamente no centro, como o ícone da splash; o texto vai abaixo, sem empurrá-lo.
  opening: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  openingLabel: { position: 'absolute', top: '50%', marginTop: SPLASH_IMAGE_WIDTH / 2 + 24 },
});
