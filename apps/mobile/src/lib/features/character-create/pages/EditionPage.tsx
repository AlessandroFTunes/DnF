import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DiferenteKey } from '@dnf/core/util';
import { radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { EDITION_INFO } from '../../features/character-create/labels';
import { srd, useSrd } from '../../lib/srd';

/** Antes das etapas: escolher entre as regras de 2014 e de 2024. */
export default function EditionPage() {
  const { draft, setEdition } = useCharacterDraft();

  return (
    <StepScreen
      title="Escolha a edição"
      subtitle="As regras mudam entre as edições. Todo o resto da criação usa os livros da edição escolhida."
      canContinue={draft.edition !== null}
    >
      {DiferenteKey.EDITIONS.map((edition) => (
        <EditionCard
          key={edition}
          edition={edition}
          selected={draft.edition === edition}
          onPress={() => setEdition(edition)}
        />
      ))}
    </StepScreen>
  );
}

function EditionCard({
  edition,
  selected,
  onPress,
}: {
  edition: DiferenteKey.Edition;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useRpgTheme();
  const info = EDITION_INFO[edition];
  // Números ao vivo do compêndio (as listas ficam em cache para as próximas etapas).
  const classes = useSrd(`classes:${edition}`, () => srd.classes(edition));
  const species = useSrd(`species:${edition}`, () => srd.species(edition));
  const backgrounds = useSrd(`backgrounds:${edition}`, () => srd.backgrounds(edition));
  const count = (s: { status: string; data?: unknown[] }) => (s.status === 'ready' ? String(s.data?.length) : '–');
  // Edição ainda sem classes na API: não dá para criar personagem nela.
  const empty = classes.status === 'ready' && classes.data.length === 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={empty && !selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: empty && !selected }}
      accessibilityLabel={`D&D ${info.title}, ${info.subtitle}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised,
          borderColor: selected ? theme.accent : theme.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: empty && !selected ? 0.5 : 1,
        },
        shadow(theme, selected ? 3 : 1),
      ]}
    >
      {/* moldura dourada interna */}
      <View style={[styles.innerFrame, { pointerEvents: 'none' }, { borderColor: selected ? theme.gold : theme.goldSoft }]} />
      <MaterialCommunityIcons
        name="dice-d20-outline"
        size={120}
        color={selected ? theme.accent : theme.border}
        style={styles.watermark}
      />

      <View style={styles.cardTop}>
        <Text style={[typography.overline, { color: theme.gold }]}>Dungeons & Dragons</Text>
        <View
          style={[
            styles.check,
            { borderColor: selected ? theme.accent : theme.borderStrong, backgroundColor: selected ? theme.accent : 'transparent' },
          ]}
        >
          {selected && <MaterialCommunityIcons name="check-bold" size={14} color={theme.accentText} />}
        </View>
      </View>

      <Text style={[styles.year, { color: selected ? theme.accent : theme.text }]}>{info.title}</Text>
      <Text style={[typography.bodyStrong, { color: theme.text }]}>{info.subtitle}</Text>
      <Text style={[typography.caption, { color: theme.textMuted }]}>
        {empty ? 'Ainda não há livros desta edição na API.' : info.tagline}
      </Text>

      <View style={[styles.stats, { borderTopColor: theme.border }]}>
        <Stat label="classes" value={count(classes)} />
        <Stat label="espécies" value={count(species)} />
        <Stat label="antecedentes" value={count(backgrounds)} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.stat}>
      <Text style={[typography.heading, { color: theme.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  innerFrame: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  watermark: { position: 'absolute', right: -18, top: 10, opacity: 0.35 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  year: { ...typography.hero, fontSize: 48, lineHeight: 56 },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center' },
});
