import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier } from '@dnf/core/character';
import { fonts, formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { ABILITY_LABEL } from '../../character-create/labels';
import { HpTracker, Panel, SmallButton } from '../components';
import { Emblem, type EmblemShape } from '../emblems';
import type { Sheet } from '../useSheet';

/** Emblema do painel de status: o número dentro da forma, com o nome e um detalhe embaixo. */
function Tile({ label, value, detail, shape, accent }: { label: string; value: string; detail?: string; shape: EmblemShape; accent?: boolean }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <Emblem shape={shape} value={value} accent={accent} />
      <Text style={[styles.tileLabel, { color: accent ? theme.accent : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {detail ? (
        <Text style={[styles.tileDetail, { color: theme.textMuted }]} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Painel de status do topo da ficha: PV, CA, dados de vida e o resto do que se olha a cada rodada. */
export function StatusPanel({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  if (!character || !derived) return null;
  const combat = character.combat;
  const pools = derived.hitDice;
  const speed = derived.species?.speed || '—';

  /** Descanso longo: em 2024 todos os dados de vida voltam; em 2014, metade do nível (mínimo 1), dos maiores primeiro. */
  const recovered = () => {
    if (character.edition === '2024') return {};
    let left = Math.max(1, Math.floor(character.level / 2));
    const spent: Record<string, number> = {};
    for (const p of pools) {
      const back = Math.min(p.spent, left);
      left -= back;
      if (p.spent - back > 0) spent[String(p.die)] = p.spent - back;
    }
    return spent;
  };

  const longRest = () =>
    save(
      {
        combat: {
          hpCurrent: combat.hpMax,
          hpTemp: 0,
          deathSaves: { successes: 0, failures: 0 },
          hitDiceSpent: recovered(),
        },
        spellcasting: { slotsUsed: {}, pactSlotsUsed: 0 },
        featureUses: {},
      },
      (c) => ({
        ...c,
        combat: { ...c.combat, hpCurrent: c.combat.hpMax, hpTemp: 0, deathSaves: { successes: 0, failures: 0 } },
        spellcasting: { ...c.spellcasting, slotsUsed: {}, pactSlotsUsed: 0 },
      }),
    );

  /** Descanso curto: gasta um dado de vida do tipo escolhido (média do dado + CON). */
  const spendHitDie = (die: number) => {
    const heal = Math.max(1, Math.floor(die / 2) + 1 + abilityModifier(derived.scores.con));
    const hpCurrent = Math.min(combat.hpMax, combat.hpCurrent + heal);
    const hitDiceSpent = { ...combat.hitDiceSpent, [die]: (combat.hitDiceSpent[die] ?? 0) + 1 };
    void save(
      // A Magia de Pacto volta no descanso curto.
      { combat: { hpCurrent, hitDiceSpent }, spellcasting: { pactSlotsUsed: 0 } },
      (c) => ({
        ...c,
        combat: { ...c.combat, hpCurrent, hitDiceSpent },
        spellcasting: { ...c.spellcasting, pactSlotsUsed: 0 },
      }),
    );
  };

  return (
    <Panel
      title="Status"
      icon="heart-pulse"
      right={
        <Pressable
          disabled={!isOwner}
          onPress={() => save({ inspiration: !character.inspiration }, (c) => ({ ...c, inspiration: !c.inspiration }))}
          accessibilityRole="switch"
          accessibilityState={{ checked: character.inspiration }}
          accessibilityLabel="Inspiração"
          style={[
            styles.inspiration,
            {
              borderColor: character.inspiration ? theme.gold : theme.border,
              backgroundColor: character.inspiration ? theme.goldSoft : 'transparent',
            },
          ]}
        >
          <MaterialCommunityIcons name={character.inspiration ? 'star' : 'star-outline'} size={16} color={theme.gold} />
          <Text style={[typography.caption, { color: theme.text, fontWeight: '700' }]}>Inspiração</Text>
        </Pressable>
      }
    >
      <HpTracker
        combat={combat}
        editable={isOwner}
        onChange={(next) => save({ combat: next }, (c) => ({ ...c, combat: { ...c.combat, ...next } }))}
      />

      <View style={styles.tiles}>
        <Tile
          label="Classe de Armadura"
          value={String(derived.ac.value)}
          detail={derived.ac.parts.map((p, i) => `${p.label} ${i === 0 ? p.value : formatBonus(p.value)}`).join(' · ')}
          shape="shield"
          accent
        />
        <Tile label="Deslocamento" value={speed.replace(/\s*metros?$/i, '')} detail="metros" shape="boot" />
        <Tile label="Proficiência" value={formatBonus(derived.pb)} shape="star" />
        <Tile
          label="Dados de vida"
          value={String(pools.reduce((n, p) => n + p.total - p.spent, 0))}
          detail={pools.map((p) => `${p.total - p.spent}/${p.total} d${p.die}`).join(' · ')}
          shape="d20"
        />
        <Tile label="Iniciativa" value={formatBonus(abilityModifier(derived.scores.dex))} detail="Destreza" shape="stopwatch" />
        <Tile label="Percepção passiva" value={String(derived.passivePerception)} shape="eye" />
      </View>

      {isOwner && (
        <View style={styles.row}>
          {pools.map((p) => (
            <SmallButton
              key={p.die}
              icon="campfire"
              label={pools.length > 1 ? `Descanso curto (d${p.die})` : 'Descanso curto'}
              onPress={() => spendHitDie(p.die)}
              disabled={p.spent >= p.total || combat.hpCurrent >= combat.hpMax}
            />
          ))}
          <SmallButton icon="bed" label="Descanso longo" onPress={() => void longRest()} />
        </View>
      )}
    </Panel>
  );
}

/** Os seis atributos com modificador, valor e salvaguarda. */
export function Abilities({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { derived } = sheet;
  if (!derived) return null;

  return (
    <Panel title="Atributos e salvaguardas" icon="arm-flex">
      <View style={styles.abilities}>
        {ABILITIES.map((a) => {
          const proficient = derived.klass.savingThrows.includes(a);
          return (
            <View
              key={a}
              style={[styles.ability, { borderColor: proficient ? theme.gold : theme.border, backgroundColor: theme.surface }]}
              accessible
              accessibilityLabel={`${ABILITY_LABEL[a].name} ${derived.scores[a]}, salvaguarda ${formatBonus(derived.saves[a])}`}
            >
              <Text style={[typography.overline, { color: theme.textMuted }]}>{ABILITY_LABEL[a].short}</Text>
              <Text style={[styles.mod, { color: theme.text }]}>{formatBonus(abilityModifier(derived.scores[a]))}</Text>
              <View style={[styles.score, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                <Text style={[typography.caption, { color: theme.text, fontWeight: '800' }]}>{derived.scores[a]}</Text>
              </View>
              <View style={styles.saveRow}>
                <MaterialCommunityIcons
                  name={proficient ? 'shield-half-full' : 'shield-outline'}
                  size={12}
                  color={proficient ? theme.gold : theme.textMuted}
                />
                <Text style={[styles.save, { color: theme.textMuted }]}>{formatBonus(derived.saves[a])}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inspiration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.sm },
  tile: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.xs },
  tileLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: spacing.xs },
  tileDetail: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  abilities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ability: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  mod: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 32 },
  score: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  save: { fontSize: 11, fontWeight: '700' },
});
