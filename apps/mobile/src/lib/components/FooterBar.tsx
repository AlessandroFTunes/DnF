import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing, useRpgTheme } from '@dnf/ui-react-native';

/** Rodapé fixo com os botões de ação da tela (linha fina em cima). */
export function FooterBar({ children }: { children: ReactNode }) {
  const theme = useRpgTheme();
  return <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
