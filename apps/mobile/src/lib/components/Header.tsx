import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { ICON_BUTTON_SIZE, IconButton, type IconName } from './IconButton';

interface HeaderProps {
  /** Botão da esquerda: `back` (seta) ou `close` (X). */
  action: { kind: 'back' | 'close'; label?: string; onPress: () => void };
  /** Texto no centro. `heading` = título grande; `overline` = rótulo pequeno (padrão). */
  title?: string;
  titleStyle?: 'heading' | 'overline';
  /** Conteúdo do centro no lugar do `title` (ex.: chip da edição). */
  center?: ReactNode;
  /** Conteúdo da direita (ex.: outro `IconButton`, um selo). */
  right?: ReactNode;
}

/** Barra do topo das telas: ação à esquerda, título no centro, extra à direita. */
export function Header({ action, title, titleStyle = 'overline', center, right }: HeaderProps) {
  const theme = useRpgTheme();
  const icon = action.kind === 'back' ? 'chevron-left' : 'close';
  return (
    <View style={styles.bar}>
      <IconButton icon={icon} label={action.label ?? (action.kind === 'back' ? 'Voltar' : 'Cancelar')} onPress={action.onPress} />
      <View style={styles.center}>
        {center ??
          (title ? (
            <Text
              style={[typography[titleStyle], { color: titleStyle === 'heading' ? theme.text : theme.textMuted }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null)}
      </View>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

/** Abertura da tela: ícone, título e texto de apoio, centralizados. */
export function PageHeading({ icon, title, overline, subtitle }: { icon?: IconName; title: string; overline?: string; subtitle?: string }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.heading}>
      {icon && <MaterialCommunityIcons name={icon} size={36} color={theme.gold} />}
      <Text style={[typography.title, styles.centered, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {overline ? <Text style={[typography.overline, { color: theme.gold }]}>{overline}</Text> : null}
      {subtitle ? <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Rótulo pequeno de seção ("NOME DA MESA", "ALINHAMENTO"…). */
export function SectionLabel({ children }: { children: string }) {
  const theme = useRpgTheme();
  return <Text style={[typography.overline, { color: theme.textMuted, marginTop: spacing.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  center: { flex: 1, alignItems: 'center' },
  spacer: { width: ICON_BUTTON_SIZE },
  heading: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  centered: { textAlign: 'center' },
});
