import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, shadow, spacing, touchTarget, typography, useRpgTheme } from '../theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = ação principal, secondary = com borda, ghost = só texto. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Ícone à esquerda (o app passa o componente de ícone já com tamanho). */
  icon?: (color: string) => ReactNode;
  /** Ícone à direita, ex.: seta de "Continuar". */
  trailingIcon?: (color: string) => ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Botão padrão do app. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const theme = useRpgTheme();
  const inactive = disabled || loading;
  const color = variant === 'primary' ? theme.accentText : variant === 'secondary' ? theme.text : theme.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && [{ backgroundColor: theme.accent }, shadow(theme, 1)],
        variant === 'secondary' && { backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed && !inactive ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.content}>
          {icon?.(color)}
          <Text style={[typography.button, { color }]} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon?.(color)}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
