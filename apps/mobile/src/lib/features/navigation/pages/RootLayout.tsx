import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_800ExtraBold } from '@expo-google-fonts/cinzel';
import { fonts, typography, useRpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../../auth/functions/hook.session';
import { isPlayerQuery, PLAYER_CACHE_VERSION, PLAYER_MAX_AGE, queryClient } from '../../../query-client';
import { QueryDevtools } from '../../cache/functions/QueryDevtools';
import { queryPersister } from '../../cache/functions/query-persister';
import { prefetchSrd } from '../../srd/functions';
import { OpeningDie, SPLASH_IMAGE_WIDTH } from '../animations/OpeningDie';

// A splash nativa fica até o primeiro quadro do app; o compêndio começa a abrir já aqui, durante ela.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
const compendiumReady = prefetchSrd();


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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PLAYER_MAX_AGE,
        buster: PLAYER_CACHE_VERSION,
        // Só os dados do jogador vão para o aparelho; o compêndio já tem o próprio cache em disco.
        dehydrateOptions: { shouldDehydrateQuery: (q) => isPlayerQuery(q) && q.state.status === 'success', shouldDehydrateMutation: () => false },
      }}
    >
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
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="character/new" options={{ headerShown: false }} />
          <Stack.Screen name="character/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="character/[id]/spells" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="mesa/new" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="mesa/join" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="perfil/editar" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
      <QueryDevtools />
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  // O emblema fica exatamente no centro, como o ícone da splash; o texto vai abaixo, sem empurrá-lo.
  opening: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  openingLabel: { position: 'absolute', top: '50%', marginTop: SPLASH_IMAGE_WIDTH / 2 + 24 },
});
