import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { plainText, type SrdSpell } from '@dnf/sdk/srd';
import { Chip, formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { srd, tr, useSrd } from '../../../lib/srd';
import { abilityName, rangeLabel } from '../../character-create/labels';
import { Panel, SmallButton, StatBox } from '../components';
import type { Sheet } from '../useSheet';

const LEVEL_LABEL = (level: number) => (level === 0 ? 'Truques' : `${level}º círculo`);

export function Spells({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  const [learning, setLearning] = useState(false);
  // Multiclasse: cada classe aprende da própria lista, até o círculo que o nível nela dá.
  const [learnIndex, setLearnIndex] = useState(0);
  const caster = derived?.casters[learnIndex] ?? derived?.casters[0] ?? null;
  const classKey = caster?.cls.key ?? null;
  const maxLevel = caster?.maxCircle ?? 0;
  const edition = character?.edition;
  const available = useSrd(learning && classKey ? `spells:${classKey}:${maxLevel}:${edition}` : null, () =>
    srd.spells(classKey!, maxLevel, edition),
  );
  if (!character || !derived) return null;
  const { castAbility, magic, slots, pact, casters, spells } = derived;
  const used = character.spellcasting.slotsUsed;
  const pactUsed = Math.min(pact?.count ?? 0, character.spellcasting.pactSlotsUsed);
  const setPactUsed = (pactSlotsUsed: number) =>
    void save({ spellcasting: { pactSlotsUsed } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, pactSlotsUsed } }));
  const prepared = new Map(character.spellcasting.spells.map((s) => [s.key, s.prepared]));

  const setUsed = (level: string, count: number) => {
    const slotsUsed = { ...used, [level]: count };
    void save({ spellcasting: { slotsUsed } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, slotsUsed } }));
  };
  const setSpells = (list: typeof character.spellcasting.spells) =>
    void save({ spellcasting: { spells: list } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, spells: list } }));
  const learn = (key: string) => setSpells([...character.spellcasting.spells, { key, prepared: true }]);
  const forget = (key: string) => setSpells(character.spellcasting.spells.filter((s) => s.key !== key));
  const known = new Set(character.spellcasting.spells.map((s) => s.key));

  const togglePrepared = (key: string) => {
    const list = character.spellcasting.spells.map((s) => (s.key === key ? { ...s, prepared: !s.prepared } : s));
    void save({ spellcasting: { spells: list } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, spells: list } }));
  };

  const byLevel = new Map<number, SrdSpell[]>();
  for (const s of spells) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s]);
  const slotLevels = Object.keys(slots).sort();

  if (!castAbility && spells.length === 0 && !derived.spellsLoading) {
    return (
      <Panel title="Magias" icon="auto-fix">
        <Text style={[typography.body, { color: theme.textMuted }]}>Este personagem não conjura magias.</Text>
      </Panel>
    );
  }

  return (
    <View style={styles.column}>
      {castAbility && magic && (
        <Panel title="Conjuração" icon="auto-fix">
          {casters.map((c) => (
            <View key={c.cls.key} style={styles.casterBlock}>
              {casters.length > 1 && <Text style={[typography.caption, { color: theme.textMuted }]}>{tr.name(c.cls)}</Text>}
              <View style={styles.stats}>
                <StatBox label="Atributo" value={abilityName(c.ability).slice(0, 3).toUpperCase()} />
                <StatBox label="CD" value={String(c.magic.saveDC)} accent />
                <StatBox label="Ataque" value={formatBonus(c.magic.attack)} />
              </View>
            </View>
          ))}
          {slotLevels.map((level) => (
            <SlotRow
              key={level}
              label={`${level}º`}
              name={`Espaço de ${level}º círculo`}
              total={slots[level] ?? 0}
              spent={Math.min(slots[level] ?? 0, used[level as keyof typeof used] ?? 0)}
              editable={isOwner}
              onChange={(n) => setUsed(level, n)}
            />
          ))}
          {pact && (
            <SlotRow
              label={`P${pact.circle}º`}
              name={`Espaço de Magia de Pacto (${pact.circle}º círculo)`}
              total={pact.count}
              spent={pactUsed}
              editable={isOwner}
              onChange={setPactUsed}
            />
          )}
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            Toque num espaço para gastar; o descanso longo recupera todos{pact ? ' (os de Pacto, marcados com P, também voltam no descanso curto)' : ''}.
          </Text>
          {isOwner && (
            <SmallButton
              icon={learning ? 'close' : 'book-plus-outline'}
              label={learning ? 'Fechar lista' : 'Aprender magia'}
              onPress={() => setLearning(!learning)}
            />
          )}
        </Panel>
      )}

      {learning && (
        <Panel title={`Lista de ${tr.name(caster?.cls ?? derived.cls)} (${maxLevel ? `até ${maxLevel}º círculo` : 'truques'})`} icon="book-plus-outline">
          {casters.length > 1 && (
            <View style={styles.chips}>
              {casters.map((c, i) => (
                <Chip key={c.cls.key} label={tr.name(c.cls)} selected={c === caster} onPress={() => setLearnIndex(i)} />
              ))}
            </View>
          )}
          {available.status !== 'ready' ? (
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              {available.status === 'error' ? 'Não deu para carregar a lista.' : 'Carregando…'}
            </Text>
          ) : (
            available.data
              .filter((s) => !known.has(s.key))
              .map((s) => (
                <View key={s.key} style={[styles.learnRow, { borderColor: theme.border }]}>
                  <Text style={[typography.caption, styles.levelTag, { color: theme.gold }]}>{s.level === 0 ? 'T' : `${s.level}º`}</Text>
                  <Text style={[typography.body, styles.flex, { color: theme.text }]}>{tr.name(s, 'spell')}</Text>
                  <SmallButton icon="plus" label="Aprender" onPress={() => learn(s.key)} />
                </View>
              ))
          )}
        </Panel>
      )}

      {derived.spellsLoading && (
        <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>Carregando magias…</Text>
      )}

      {[...byLevel.entries()]
        .sort(([a], [b]) => a - b)
        .map(([level, list]) => (
          <Panel key={level} title={LEVEL_LABEL(level)} icon={level === 0 ? 'creation' : 'book-open-variant'}>
            {list.map((spell) => (
              <SpellRow
                key={spell.key}
                spell={spell}
                prepared={level === 0 ? null : (prepared.get(spell.key) ?? false)}
                onTogglePrepared={isOwner && level > 0 ? () => togglePrepared(spell.key) : undefined}
                onForget={isOwner ? () => forget(spell.key) : undefined}
              />
            ))}
          </Panel>
        ))}
    </View>
  );
}

/** Uma linha de espaços de magia: toque num para gastar ou devolver. */
function SlotRow({
  label,
  name,
  total,
  spent,
  editable,
  onChange,
}: {
  label: string;
  name: string;
  total: number;
  spent: number;
  editable: boolean;
  onChange: (spent: number) => void;
}) {
  const theme = useRpgTheme();
  return (
    <View style={styles.slotRow}>
      <Text style={[typography.bodyStrong, styles.slotLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.pips}>
        {Array.from({ length: total }, (_, i) => {
          const isUsed = i < spent;
          return (
            <Pressable
              key={i}
              disabled={!editable}
              onPress={() => onChange(isUsed ? i : i + 1)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isUsed }}
              accessibilityLabel={`${name} ${i + 1}${isUsed ? ', gasto' : ''}`}
              hitSlop={4}
              style={[styles.pip, { borderColor: theme.accent, backgroundColor: isUsed ? 'transparent' : theme.accent }]}
            />
          );
        })}
      </View>
      <Text style={[typography.caption, { color: theme.textMuted }]}>
        {total - spent}/{total}
      </Text>
    </View>
  );
}

function SpellRow({
  spell,
  prepared,
  onTogglePrepared,
  onForget,
}: {
  spell: SrdSpell;
  prepared: boolean | null;
  onTogglePrepared?: () => void;
  onForget?: () => void;
}) {
  const theme = useRpgTheme();
  const [open, setOpen] = useState(false);
  const tags = [spell.school?.name && tr.text(spell.school.name), rangeLabel(spell.range_text), spell.concentration ? 'Concentração' : null, spell.ritual ? 'Ritual' : null].filter(Boolean);
  return (
    <View style={[styles.spell, { borderColor: theme.border }]}>
      <View style={styles.spellHeader}>
        {prepared !== null && (
          <Pressable
            onPress={onTogglePrepared}
            disabled={!onTogglePrepared}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: prepared }}
            accessibilityLabel={`Preparada: ${tr.name(spell, 'spell')}`}
            hitSlop={6}
          >
            <MaterialCommunityIcons name={prepared ? 'bookmark' : 'bookmark-outline'} size={20} color={theme.accent} />
          </Pressable>
        )}
        <Pressable style={styles.flex} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={[typography.bodyStrong, { color: theme.text }]}>{tr.name(spell, 'spell')}</Text>
          <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
            {tags.join(' · ')}
          </Text>
        </Pressable>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textMuted} />
      </View>
      {open && (
        <Text style={[typography.caption, { color: theme.text }]}>
          {plainText(tr.desc(spell))}
          {spell.higher_level ? `\n\nEm círculos maiores: ${plainText(tr.field(spell.key, 'higher_level', spell.higher_level))}` : ''}
        </Text>
      )}
      {open && onForget && <SmallButton icon="delete-outline" label="Esquecer" tone="danger" onPress={onForget} />}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  slotLabel: { width: 36 },
  casterBlock: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pip: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2 },
  spell: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.sm },
  spellHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  levelTag: { width: 24, fontWeight: '800' },
});
