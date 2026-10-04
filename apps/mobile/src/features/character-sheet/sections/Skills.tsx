import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { skillBonus } from '@dnf/sdk/srd';
import { formatBonus, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { ABILITY_LABEL, skillLabel } from '../../character-create/labels';
import { Panel } from '../components';
import type { SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';

export function Skills({ data }: { data: SheetData }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.column}>
      <Panel title="Perícias" icon="star-four-points-outline">
        {data.skills.map((s, i) => {
          const level = data.skillLevels[s.key];
          return (
            <View
              key={s.key}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
              accessible
              accessibilityLabel={`${skillLabel(s.key, s.name)} ${formatBonus(skillBonus(s, data.scores, level, data.pb))}`}
            >
              <MaterialCommunityIcons
                name={level === 'expertise' ? 'star-circle' : level ? 'circle' : 'circle-outline'}
                size={14}
                color={level ? theme.accent : theme.textMuted}
              />
              <Text style={[typography.body, styles.flex, { color: theme.text }]}>{skillLabel(s.key, s.name)}</Text>
              <Text style={[typography.caption, { color: theme.textMuted, width: 36 }]}>{ABILITY_LABEL[s.ability].short}</Text>
              <Text style={[typography.bodyStrong, styles.value, { color: level ? theme.text : theme.textMuted }]}>
                {formatBonus(skillBonus(s, data.scores, level, data.pb))}
              </Text>
            </View>
          );
        })}
      </Panel>

      <Panel title="Proficiências e idiomas" icon="school-outline">
        <Line label="Armaduras" value={data.klass.armorTraining || 'Nenhuma'} />
        <Line label="Armas" value={data.klass.weaponTraining || '—'} />
        <Line
          label="Ferramentas"
          value={[data.klass.toolTraining, data.bg?.tools].filter((t) => t && !/^none$/i.test(t)).join('; ') || '—'}
        />
        <Line label="Idiomas" value={data.knownLanguages.map((l) => tr.name(l)).join(', ') || '—'} />
      </Panel>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const theme = useRpgTheme();
  return (
    <Text style={[typography.body, { color: theme.text }]}>
      <Text style={{ fontWeight: '700' }}>{label}: </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  flex: { flex: 1 },
  value: { width: 40, textAlign: 'right' },
});
