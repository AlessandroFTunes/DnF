import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../hooks/hook.session';

export default function RootLayout() {
  const { status } = useSession();
  const theme = useRpgTheme();

  // Até ler o token do Keychain não dá pra saber qual tela mostrar.
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
        <ActivityIndicator color={theme.accent} />
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
          headerTitleStyle: { color: theme.text },
          contentStyle: { backgroundColor: theme.surface },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="character/new" options={{ title: 'Novo personagem' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
