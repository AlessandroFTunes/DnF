import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Character } from '@dnf/core/character';
import { isSpellcastingFeature, plainText, spellCountsAt } from '@dnf/sdk/srd';
import { formatBonus, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { abilityName, classIcon, type IconName } from '../../character-create/labels';
import { BottomSheet } from '../BottomSheet';
import { Panel } from '../components';
import type { Sheet, SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';

/** Item expansível: nome + nível; o texto completo da 5e-FastAPI ao abrir. Com resumo, o texto só aparece ao abrir. */
function Feature({ name, badge, desc, summary, note }: Omit<FeatureItem, 'key'>) {
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
      {summary ? (
        <>
          <View style={styles.summary}>
            {summary.map((s) => (
              <View key={s.label} style={[styles.summaryItem, { borderColor: theme.border }]}>
                <Text style={[typography.heading, styles.summaryValue, { color: theme.text }]}>{s.value}</Text>
                <View style={styles.flex}>
                  <Text style={[typography.bodyStrong, { color: theme.text }]}>{s.label}</Text>
                  <Text style={[typography.caption, { color: theme.textMuted }]}>{s.calc}</Text>
                </View>
              </View>
            ))}
          </View>
          {note && <Text style={[typography.caption, { color: theme.gold, fontWeight: '700' }]}>{note}</Text>}
          {open ? (
            <Text style={[typography.caption, { color: theme.text }]}>{text}</Text>
          ) : (
            <Text style={[typography.caption, { color: theme.accent }]}>Ver regra completa</Text>
          )}
        </>
      ) : (
        <Text style={[typography.caption, { color: theme.text }]} numberOfLines={open ? undefined : 2}>
          {text}
        </Text>
      )}
    </Pressable>
  );
}

interface FeatureItem {
  key: string;
  name: string;
  badge?: string;
  desc?: string;
  /** Números já calculados para o personagem; trocam o texto longo (ex.: Conjuração). */
  summary?: { label: string; value: string; calc: string }[];
  /** Linha curta abaixo do resumo (o que ganha no próximo nível). */
  note?: string;
}

interface FeatureGroup {
  key: string;
  /** Rótulo curto do ícone ("Guardião", "Elfo"). */
  label: string;
  /** O que o grupo é ("Classe", "Espécie"…). */
  kind: string;
  /** Título da folha ("Habilidades de Guardião"). */
  title: string;
  icon: IconName;
  items: FeatureItem[];
}

const levelBadge = (f: { gained_at?: { level: number }[] | null }) => `Nv ${Math.min(...(f.gained_at ?? []).map((g) => g.level))}`;

/** Resumo da Conjuração: quantos truques, magias e espaços o personagem tem, com a conta de cada um. */
function castingSummary(data: SheetData, entry: SheetData['classes'][number]): Pick<FeatureItem, 'summary' | 'note'> {
  const now = spellCountsAt(entry.cls, entry.level, data.scores);
  if (!now) return {};
  const table = `Tabela do ${tr.name(entry.cls)}, nível ${entry.level}`;
  const summary: NonNullable<FeatureItem['summary']> = [];
  if (now.cantrips) summary.push({ label: 'Truques', value: String(now.cantrips), calc: table });
  if (now.spells) {
    const f = now.formula;
    summary.push({
      label: now.prepared ? 'Magias preparadas' : 'Magias conhecidas',
      value: String(now.spells),
      calc: f
        ? `Mod. ${abilityName(f.ability)} (${formatBonus(f.modifier)}) + ${f.half ? 'metade do nível' : 'nível'} (${f.level})${
            f.modifier + f.level < 1 ? ', mínimo 1' : ''
          }`
        : table,
    });
  }
  const slots = Object.entries(data.slots).filter(([, n]) => n);
  if (slots.length) {
    summary.push({
      label: 'Espaços de magia',
      value: slots.map(([circle, n]) => `${n}×${circle}º`).join('  '),
      calc: data.classes.length > 1 ? 'Tabela de multiclasse' : table,
    });
  }
  if (data.pact) summary.push({ label: 'Magia de Pacto', value: `${data.pact.count}×${data.pact.circle}º`, calc: table });

  const next = entry.level < 20 ? spellCountsAt(entry.cls, entry.level + 1, data.scores) : null;
  const gains = [
    next && next.cantrips > now.cantrips ? `+${next.cantrips - now.cantrips} truque` : null,
    next && next.spells > now.spells ? `+${next.spells - now.spells} magia` : null,
  ].filter(Boolean);
  return { summary, note: gains.length ? `No nível ${entry.level + 1}: ${gains.join(', ')}` : undefined };
}

function featureGroups(data: SheetData): FeatureGroup[] {
  const groups: FeatureGroup[] = [];
  const multiclass = data.classes.length > 1;
  for (const c of data.classes) {
    const name = tr.name(c.cls);
    groups.push({
      key: `class:${c.cls.key}`,
      label: name,
      kind: multiclass ? `Classe · nível ${c.level}` : 'Classe',
      title: `Habilidades de ${name}`,
      icon: classIcon(c.cls.name),
      items: c.features.map((f) => ({
        key: f.key,
        name: tr.name(f),
        badge: levelBadge(f),
        desc: f.desc,
        ...(isSpellcastingFeature(f.name) ? castingSummary(data, c) : {}),
      })),
    });
    if (c.subclass && c.subclassFeatures.length > 0) {
      groups.push({
        key: `subclass:${c.subclass.key}`,
        label: tr.name(c.subclass),
        kind: 'Subclasse',
        title: tr.name(c.subclass),
        icon: 'star-shooting-outline',
        items: c.subclassFeatures.map((f) => ({ key: f.key, name: tr.name(f), badge: levelBadge(f), desc: f.desc })),
      });
    }
  }
  if (data.species && data.species.traits.length > 0) {
    const name = data.chain.length ? tr.name(data.chain.at(-1)!) : 'Espécie';
    groups.push({
      key: 'species',
      label: name,
      kind: 'Espécie',
      title: `Traços de ${name}`,
      icon: 'account-outline',
      items: data.species.traits.map((t) => ({
        key: t.name,
        name: tr.text(t.name),
        desc: tr.field(data.chain[0]?.key ?? '', `trait:${t.name}`, t.desc),
      })),
    });
  }
  const backgroundFeature = data.background?.benefits.find((b) => b.type === 'feature');
  const origin: FeatureItem[] = [
    ...(backgroundFeature?.desc
      ? [
          {
            key: 'background',
            name: tr.text(backgroundFeature.name),
            badge: data.background ? tr.name(data.background) : undefined,
            desc: backgroundFeature.desc,
          },
        ]
      : []),
    ...data.feats.map((f) => ({
      key: f.key,
      name: tr.name(f),
      badge: 'Talento',
      desc: [tr.desc(f), ...f.benefits.map((b, i) => `• ${tr.field(f.key, `benefit:${i}`, b.desc ?? '')}`)]
        .filter(Boolean)
        .join('\n'),
    })),
  ];
  if (origin.length > 0) {
    groups.push({
      key: 'origin',
      label: data.background ? tr.name(data.background) : 'Talentos',
      kind: 'Antecedente e talentos',
      title: 'Antecedente e talentos',
      icon: 'medal-outline',
      items: origin,
    });
  }
  return groups;
}

/** Um ícone por classe, subclasse, espécie e antecedente; tocar abre a lista numa folha de baixo. */
export function Features({ data }: { data: SheetData }) {
  const theme = useRpgTheme();
  const groups = featureGroups(data);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Guarda o último grupo aberto para a folha não ficar vazia enquanto desce.
  const [shownKey, setShownKey] = useState<string | null>(null);
  if (openKey && openKey !== shownKey) setShownKey(openKey);
  const shown = groups.find((g) => g.key === shownKey);

  return (
    <View style={styles.tiles}>
      {groups.map((g) => (
        <Pressable
          key={g.key}
          onPress={() => setOpenKey(g.key)}
          accessibilityRole="button"
          accessibilityLabel={`${g.title}, ${g.items.length}`}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: pressed ? theme.surfaceSunken : theme.surfaceRaised, borderColor: theme.border },
            shadow(theme, 1),
          ]}
        >
          <View style={[styles.tileIcon, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
            <MaterialCommunityIcons name={g.icon} size={26} color={theme.gold} />
          </View>
          <Text style={[typography.bodyStrong, styles.center, { color: theme.text }]} numberOfLines={2}>
            {g.label}
          </Text>
          <Text style={[typography.caption, styles.center, { color: theme.textMuted }]} numberOfLines={1}>
            {g.kind} · {g.items.length}
          </Text>
        </Pressable>
      ))}
      <BottomSheet visible={!!openKey} onClose={() => setOpenKey(null)} title={shown?.title ?? ''} icon={shown?.icon}>
        {shown?.items.map(({ key, ...f }) => <Feature key={key} {...f} />)}
      </BottomSheet>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileIcon: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  feature: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.xs },
  featureHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  summary: { gap: spacing.xs },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryValue: { minWidth: 36, textAlign: 'center' },
  field: { gap: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 15 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
});
