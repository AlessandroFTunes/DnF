import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Character } from '@dnf/core/character';
import { plainText } from '@dnf/sdk/srd';
import { radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Panel } from '../components';
import type { Sheet, SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';

/** Item expansível: nome + nível; o texto completo da Open5e ao abrir. */
function Feature({ name, badge, desc }: { name: string; badge?: string; desc?: string }) {
  const theme = useRpgTheme();
  const [open, setOpen] = useState(false);
  const text = plainText(desc);
  return (
    <Pressable
      onPress={() => setOpen(!open)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={[styles.feature, { borderColor: theme.border }]}
    >
      <View style={styles.featureHeader}>
        {badge && (
          <View style={[styles.badge, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
            <Text style={[styles.badgeText, { color: theme.text }]}>{badge}</Text>
          </View>
        )}
        <Text style={[typography.bodyStrong, styles.flex, { color: theme.text }]}>{name}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textMuted} />
      </View>
      <Text style={[typography.caption, { color: theme.text }]} numberOfLines={open ? undefined : 2}>
        {text}
      </Text>
    </Pressable>
  );
}

export function Features({ data }: { data: SheetData }) {
  const backgroundFeature = data.background?.benefits.find((b) => b.type === 'feature');
  return (
    <View style={styles.column}>
      <Panel title={`Habilidades de ${tr.name(data.cls)}`} icon="sword-cross">
        {data.features.map((f) => (
          <Feature
            key={f.key}
            name={tr.name(f)}
            badge={`Nv ${Math.min(...(f.gained_at ?? []).map((g) => g.level))}`}
            desc={f.desc}
          />
        ))}
      </Panel>
      {data.subclass && data.subclassFeatures.length > 0 && (
        <Panel title={tr.name(data.subclass)} icon="star-shooting-outline">
          {data.subclassFeatures.map((f) => (
            <Feature
              key={f.key}
              name={tr.name(f)}
              badge={`Nv ${Math.min(...(f.gained_at ?? []).map((g) => g.level))}`}
              desc={f.desc}
            />
          ))}
        </Panel>
      )}
      {data.species && data.species.traits.length > 0 && (
        <Panel title={`Traços de ${data.chain.length ? tr.name(data.chain.at(-1)!) : 'espécie'}`} icon="account-outline">
          {data.species.traits.map((t) => (
            <Feature key={t.name} name={tr.text(t.name)} desc={tr.field(data.chain[0]?.key ?? '', `trait:${t.name}`, t.desc)} />
          ))}
        </Panel>
      )}
      {(backgroundFeature || data.feats.length > 0) && (
        <Panel title="Antecedente e talentos" icon="medal-outline">
          {backgroundFeature?.desc ? (
            <Feature
              name={tr.text(backgroundFeature.name)}
              badge={data.background ? tr.name(data.background) : undefined}
              desc={backgroundFeature.desc}
            />
          ) : null}
          {data.feats.map((f) => (
            <Feature
              key={f.key}
              name={tr.name(f)}
              badge="Talento"
              desc={[tr.desc(f), ...f.benefits.map((b, i) => `• ${tr.field(f.key, `benefit:${i}`, b.desc ?? '')}`)]
                .filter(Boolean)
                .join('\n')}
            />
          ))}
        </Panel>
      )}
    </View>
  );
}

type Personality = Character.Info['personality'];
type Details = Character.Info['details'];

const PERSONALITY: { key: keyof Personality; label: string }[] = [
  { key: 'traits', label: 'Traços de personalidade' },
  { key: 'ideals', label: 'Ideais' },
  { key: 'bonds', label: 'Vínculos' },
  { key: 'flaws', label: 'Defeitos' },
];
const DETAILS: { key: keyof Details; label: string; multiline?: boolean }[] = [
  { key: 'age', label: 'Idade' },
  { key: 'height', label: 'Altura' },
  { key: 'weight', label: 'Peso' },
  { key: 'eyes', label: 'Olhos' },
  { key: 'skin', label: 'Pele' },
  { key: 'hair', label: 'Cabelo' },
  { key: 'appearance', label: 'Aparência', multiline: true },
  { key: 'backstory', label: 'História', multiline: true },
  { key: 'allies', label: 'Aliados e organizações', multiline: true },
  { key: 'notes', label: 'Anotações', multiline: true },
];

/** Personalidade e história: editável pelo dono, salva ao sair do campo. */
export function Story({ sheet }: { sheet: Sheet }) {
  const { character, isOwner, save } = sheet;
  if (!character) return null;
  return (
    <View style={styles.column}>
      <Panel title="Personalidade" icon="drama-masks">
        {PERSONALITY.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={character.personality[f.key]}
            editable={isOwner}
            multiline
            onSave={(value) => save({ personality: { [f.key]: value } }, (c) => ({ ...c, personality: { ...c.personality, [f.key]: value } }))}
          />
        ))}
      </Panel>
      <Panel title="Aparência e história" icon="feather">
        {DETAILS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={character.details[f.key]}
            editable={isOwner}
            multiline={f.multiline}
            onSave={(value) => save({ details: { [f.key]: value } }, (c) => ({ ...c, details: { ...c.details, [f.key]: value } }))}
          />
        ))}
      </Panel>
    </View>
  );
}

function Field({
  label,
  value,
  editable,
  multiline,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  multiline?: boolean;
  onSave: (value: string) => void;
}) {
  const theme = useRpgTheme();
  const [text, setText] = useState(value);
  return (
    <View style={styles.field}>
      <Text style={[typography.overline, { color: theme.textMuted }]}>{label}</Text>
      {editable ? (
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => text !== value && onSave(text)}
          multiline={multiline}
          accessibilityLabel={label}
          placeholder="—"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        />
      ) : (
        <Text style={[typography.body, { color: theme.text }]}>{value || '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  flex: { flex: 1 },
  feature: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.xs },
  featureHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  field: { gap: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 15 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
});
