import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, useRpgTheme } from '@dnf/ui-react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Botão redondo só com ícone (voltar, fechar…). */
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useRpgTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceSunken : theme.surfaceRaised },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.text} />
    </Pressable>
  );
}

/** Espaço do tamanho de um `IconButton`, para centralizar o título do header. */
export const ICON_BUTTON_SIZE = 40;

const styles = StyleSheet.create({
  button: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
