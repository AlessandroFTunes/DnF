import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_800ExtraBold } from '@expo-google-fonts/cinzel';
import { DnfSpinner, fonts, typography, useRpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../hooks/hook.session';
import { prefetchSrd } from '../lib/srd';

// A splash nativa fica até o primeiro quadro do app; o compêndio começa a abrir já aqui, durante ela.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
const compendiumReady = prefetchSrd();

/** Mesmo `imageWidth` da splash (app.json): a troca da splash para a animação não pula. */
const SPLASH_IMAGE_WIDTH = 200;

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
        <DnfSpinner size={SPLASH_IMAGE_WIDTH} withSwords />
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
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="character/new" options={{ headerShown: false }} />
          <Stack.Screen name="character/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="mesa/join" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  // O emblema fica exatamente no centro, como o ícone da splash; o texto vai abaixo, sem empurrá-lo.
  opening: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  openingLabel: { position: 'absolute', top: '50%', marginTop: SPLASH_IMAGE_WIDTH / 2 + 24 },
});
