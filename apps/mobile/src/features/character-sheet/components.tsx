import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Character } from '@dnf/core/character';
import { fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import type { IconName } from '../character-create/labels';

/** Bloco com título usado em todas as seções da ficha. */
export function Panel({
  title,
  icon,
  right,
  children,
  style,
}: {
  title?: string;
  icon?: IconName;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useRpgTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, shadow(theme, 1), style]}>
      {title && (
        <View style={styles.panelHeader}>
          {icon && <MaterialCommunityIcons name={icon} size={18} color={theme.gold} />}
          <Text style={[typography.overline, styles.flex, { color: theme.textMuted }]}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/** Número grande com rótulo (CA, iniciativa…). */
export function StatBox({ label, value, icon, accent }: { label: string; value: string; icon?: IconName; accent?: boolean }) {
  const theme = useRpgTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: accent ? theme.accentSoft : theme.surface, borderColor: accent ? theme.accent : theme.border },
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      {icon && <MaterialCommunityIcons name={icon} size={16} color={accent ? theme.accent : theme.gold} />}
      <Text style={[styles.statValue, { color: accent ? theme.accent : theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SmallButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'neutral',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger' | 'positive';
}) {
  const theme = useRpgTheme();
  const color = tone === 'danger' ? theme.negative : tone === 'positive' ? theme.positive : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.small,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceSunken : theme.surface, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[typography.caption, { color, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

type Combat = Character.Info['combat'];

/** PV: barra, dano/cura com valor, PV temporários e testes contra a morte quando cai a 0. */
export function HpTracker({
  combat,
  editable,
  onChange,
}: {
  combat: Combat;
  editable: boolean;
  onChange: (next: Partial<Combat>) => void;
}) {
  const theme = useRpgTheme();
  const [amount, setAmount] = useState('1');
  const n = Math.max(0, parseInt(amount, 10) || 0);
  const ratio = combat.hpMax > 0 ? combat.hpCurrent / combat.hpMax : 0;
  const barColor = ratio > 0.5 ? theme.positive : ratio > 0.25 ? theme.gold : theme.negative;

  function damage() {
    // Dano tira primeiro dos PV temporários.
    const fromTemp = Math.min(combat.hpTemp, n);
    const hpCurrent = Math.max(0, combat.hpCurrent - (n - fromTemp));
    onChange({ hpTemp: combat.hpTemp - fromTemp, hpCurrent });
  }
  function heal() {
    onChange({
      hpCurrent: Math.min(combat.hpMax, combat.hpCurrent + n),
      deathSaves: { successes: 0, failures: 0 },
    });
  }

  const dying = combat.hpCurrent === 0;

  return (
    <View style={styles.hp}>
      <View style={styles.hpTop}>
        <MaterialCommunityIcons name="heart" size={22} color={theme.negative} />
        <Text style={[styles.hpValue, { color: theme.text }]}>
          {combat.hpCurrent}
          <Text style={[typography.body, { color: theme.textMuted }]}> / {combat.hpMax}</Text>
        </Text>
        {combat.hpTemp > 0 && (
          <View style={[styles.temp, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
            <Text style={[typography.caption, { color: theme.text, fontWeight: '800' }]}>+{combat.hpTemp} temp</Text>
          </View>
        )}
      </View>
      <View style={[styles.bar, { backgroundColor: theme.surfaceSunken }]} accessibilityRole="progressbar">
        <View style={[styles.barFill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: barColor }]} />
      </View>

      {editable && (
        <View style={styles.hpControls}>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            accessibilityLabel="Quantidade de PV"
            style={[styles.amount, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          />
          <SmallButton icon="sword" label="Dano" tone="danger" onPress={damage} disabled={n === 0} />
          <SmallButton icon="bottle-tonic-plus-outline" label="Cura" tone="positive" onPress={heal} disabled={n === 0} />
          <SmallButton icon="shield-plus-outline" label="Temp" onPress={() => onChange({ hpTemp: Math.max(combat.hpTemp, n) })} disabled={n === 0} />
        </View>
      )}

      {dying && (
        <View style={[styles.death, { borderColor: theme.negative }]}>
          <Text style={[typography.overline, { color: theme.negative }]}>Testes contra a morte</Text>
          <DeathRow
            label="Sucessos"
            count={combat.deathSaves.successes}
            color={theme.positive}
            editable={editable}
            onChange={(successes) => onChange({ deathSaves: { ...combat.deathSaves, successes } })}
          />
          <DeathRow
            label="Falhas"
            count={combat.deathSaves.failures}
            color={theme.negative}
            editable={editable}
            onChange={(failures) => onChange({ deathSaves: { ...combat.deathSaves, failures } })}
          />
        </View>
      )}
    </View>
  );
}

function DeathRow({
  label,
  count,
  color,
  editable,
  onChange,
}: {
  label: string;
  count: number;
  color: string;
  editable: boolean;
  onChange: (n: number) => void;
}) {
  const theme = useRpgTheme();
  return (
    <View style={styles.deathRow}>
      <Text style={[typography.caption, styles.flex, { color: theme.text }]}>{label}</Text>
      {[1, 2, 3].map((i) => (
        <Pressable
          key={i}
          disabled={!editable}
          onPress={() => onChange(count >= i ? i - 1 : i)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: count >= i }}
          accessibilityLabel={`${label} ${i}`}
          hitSlop={6}
        >
          <MaterialCommunityIcons name={count >= i ? 'circle' : 'circle-outline'} size={20} color={color} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stat: {
    flex: 1,
    minWidth: 76,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  statValue: { fontFamily: fonts.displayHeavy, fontSize: 22, lineHeight: 28 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  small: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  hp: { gap: spacing.sm },
  hpTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hpValue: { fontFamily: fonts.displayHeavy, fontSize: 30 },
  temp: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  bar: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  hpControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  amount: { width: 56, borderWidth: 1, borderRadius: radius.md, paddingVertical: 6, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  death: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  deathRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
