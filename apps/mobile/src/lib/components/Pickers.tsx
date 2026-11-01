import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip, fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import type { IconName } from './IconButton';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Linha de apoio (só no `TilePicker`). */
  caption?: string;
}

interface PickerProps<T extends string> {
  options: PickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Escolha única em pílulas que quebram linha (método de atributos, sub-raça, abas…). */
export function ChipPicker<T extends string>({ options, value, onChange }: PickerProps<T>) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(o.value)}
          icon={o.icon ? (c) => <MaterialCommunityIcons name={o.icon} size={16} color={c} /> : undefined}
        />
      ))}
    </View>
  );
}

/** Escolha única em blocos lado a lado, com o rótulo grande (edição 2014 / 2024…). */
export function TilePicker<T extends string>({ options, value, onChange }: PickerProps<T>) {
  const theme = useRpgTheme();
  return (
    <View style={styles.tiles} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.caption ? `${o.label}, ${o.caption}` : o.label}
            style={[
              styles.tile,
              { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised },
              selected && shadow(theme, 2),
            ]}
          >
            {o.icon && <MaterialCommunityIcons name={o.icon} size={24} color={selected ? theme.accent : theme.gold} />}
            <Text style={[styles.tileLabel, { color: selected ? theme.accent : theme.text }]}>{o.label}</Text>
            {o.caption ? <Text style={[typography.caption, styles.centered, { color: theme.textMuted }]}>{o.caption}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selo pequeno em pílula (papel na mesa, edição no topo da criação). */
export function Badge({ icon, label, solid }: { icon: IconName; label: string; solid?: boolean }) {
  const theme = useRpgTheme();
  const color = solid ? theme.accentText : theme.gold;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: solid ? theme.accent : theme.goldSoft, borderColor: solid ? theme.accent : theme.gold },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, borderWidth: 2, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  tileLabel: { fontFamily: fonts.displayHeavy, fontSize: 32 },
  centered: { textAlign: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
});
