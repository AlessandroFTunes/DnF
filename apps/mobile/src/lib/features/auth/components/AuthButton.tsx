import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, shadow, spacing, touchTarget, typography, useRpgTheme } from '@dnf/ui-react-native';

export interface AuthButtonProps {
  label: string;
  icon: (color: string) => ReactNode;
  onPress?: () => void;
  /** primary = vermelho cheio; soft = fundo rebaixado; outline = só borda, com o ícone preso à esquerda. */
  variant?: 'primary' | 'soft' | 'outline';
  /** Só mostra o ícone (o nome fica para o leitor de tela). */
  iconOnly?: boolean;
  /** Desativado, com o selo "Em breve". */
  soon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Botão das formas de entrar (email, telefone, Apple, Google), na folha de começar e no formulário. */
export function AuthButton({ label, icon, onPress, variant = 'soft', iconOnly, soon, style }: AuthButtonProps) {
  const theme = useRpgTheme();
  const color = variant === 'primary' ? theme.accentText : soon ? theme.textMuted : theme.text;
  const outline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={soon}
      accessibilityRole="button"
      accessibilityLabel={soon ? `${label}, em breve` : label}
      accessibilityState={{ disabled: !!soon }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && [{ backgroundColor: theme.accent }, shadow(theme, 1)],
        variant === 'soft' && { backgroundColor: theme.surfaceSunken, borderColor: theme.border, borderWidth: 1 },
        outline && { borderColor: theme.borderStrong, borderWidth: 1 },
        { opacity: soon ? 0.55 : pressed ? 0.8 : 1, transform: [{ scale: pressed && !soon ? 0.98 : 1 }] },
        style,
      ]}
    >
      {outline ? <View style={styles.leading}>{icon(color)}</View> : icon(color)}
      {!iconOnly && <Text style={[typography.button, { color }]}>{label}</Text>}
      {soon && (
        <View style={[styles.soon, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
          <Text style={[styles.soonText, { color: theme.gold }]}>Em breve</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  leading: { position: 'absolute', left: spacing.lg },
  soon: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, paddingVertical: 1 },
  soonText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
});
