import { Platform, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, useRpgTheme } from '@dnf/ui-react-native';

/** Barra de abas do app: Início, Mesas e Perfil. As telas de detalhe (ficha, mesa, edição) ficam na pilha acima. */
export default function TabsLayout() {
  const theme = useRpgTheme();
  const tab = (icon: keyof typeof MaterialCommunityIcons.glyphMap) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <MaterialCommunityIcons name={icon} size={size} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.surface },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.display, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.surfaceRaised,
          borderTopColor: theme.border,
          ...(Platform.OS === 'web' ? { height: 60 } : null),
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: tab('home-variant') }} />
      <Tabs.Screen name="mesa" options={{ title: 'Mesas', tabBarIcon: tab('castle') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: tab('account-circle-outline') }} />
    </Tabs>
  );
}
