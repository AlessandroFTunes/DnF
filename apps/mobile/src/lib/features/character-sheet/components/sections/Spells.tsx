import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { normalize, plainText, type SrdSpell } from '@dnf/sdk/srd';
import { Chip, formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { tr, useClasses, useSpells } from '../../../srd/functions';
import { abilityName, rangeLabel } from '../../../character-create/functions/labels';
import { Panel, SmallButton, StatBox } from '../components';
import { spellState } from '../../functions/spellRules';
import type { Sheet } from '../../functions/useSheet';

const LEVEL_LABEL = (level: number) => (level === 0 ? 'Truques' : `${level}º círculo`);

/** Como a classe lida com as magias: prepara da lista toda, prepara do grimório (Mago) ou conhece magias fixas. */
type Mode = 'list' | 'book' | 'known';

/** Resumo da ficha: atributo, CD, ataque e espaços de magia, com a porta para a tela de magias. */
export function SpellsSummary({ sheet, onOpen }: { sheet: Sheet; onOpen: () => void }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  if (!character || !derived) return null;
  const { castAbility, magic, slots, pact, casters } = derived;
  const used = character.spellcasting.slotsUsed;
  const pactUsed = Math.min(pact?.count ?? 0, character.spellcasting.pactSlotsUsed);
  const setUsed = (level: string, count: number) => {
    const slotsUsed = { ...used, [level]: count };
    void save({ spellcasting: { slotsUsed } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, slotsUsed } }));
  };
  // Truques e magias que ainda faltam escolher, somando as classes (cada magia conta para a classe que a deu).
  const levelOf = new Map(derived.spells.map((s) => [s.key, s.level]));
  const pending = casters.reduce((sum, c) => {
    if (!c.counts) return sum;
    const mine = character.spellcasting.spells.filter((s) => !s.free && (s.classKey ?? casters[0]?.cls.key) === c.cls.key);
    const cantrips = mine.filter((s) => levelOf.get(s.key) === 0).length;
    const leveled = mine.filter((s) => (levelOf.get(s.key) ?? 1) > 0 && (c.model === 'known' || s.prepared)).length;
    return sum + Math.max(0, c.counts.cantrips - cantrips) + Math.max(0, c.counts.spells - leveled);
  }, 0);
  const setPactUsed = (pactSlotsUsed: number) =>
    void save({ spellcasting: { pactSlotsUsed } }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, pactSlotsUsed } }));

  return (
    <Panel title="Magias" icon="auto-fix">
      {castAbility && magic && (
        <>
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
          {Object.keys(slots)
            .sort()
            .map((level) => (
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
        </>
      )}
      {pending > 0 && (
        <Text style={[typography.caption, { color: theme.gold, fontWeight: '700' }]}>
          Faltam {pending} {pending === 1 ? 'escolha' : 'escolhas'} de magia (nível novo).
        </Text>
      )}
      <SmallButton icon="book-open-page-variant-outline" label="Abrir magias" onPress={onOpen} />
    </Panel>
  );
}

/**
 * Tela de magias: espaços e descansos, contagem de truques e magias, escolha do que aprender ou preparar
 * (com os limites da classe no nível) e a lista do que o personagem tem.
 */
export function SpellBook({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  const [managing, setManaging] = useState(false);
  // Multiclasse: cada classe escolhe da própria lista, até o círculo que o nível nela dá.
  const [casterIndex, setCasterIndex] = useState(0);
  const [circle, setCircle] = useState<number | 'all'>('all');
  // Cavaleiro Místico e Trapaceiro Arcano (2014): a maioria das magias vem de duas escolas; o filtro pode ser desligado.
  const [bySchool, setBySchool] = useState(true);
  const caster = derived?.casters[casterIndex] ?? derived?.casters[0] ?? null;
  const classKey = caster?.cls.key ?? null;
  const maxLevel = caster?.maxCircle ?? 0;
  // Subclasse conjuradora (Cavaleiro Místico, Trapaceiro Arcano) escolhe da lista do Mago.
  const classesQ = useClasses(caster?.viaSubclass ? character?.edition : null);
  const wizardKey = classesQ.status === 'ready' ? classesQ.data.find((c) => /mago|wizard/i.test(`${c.key} ${c.name}`))?.key : undefined;
  const listKey = caster?.viaSubclass ? (wizardKey ?? null) : classKey;
  const listClass = caster?.viaSubclass ? classesQ.status === 'ready' ? classesQ.data.find((c) => c.key === wizardKey) : undefined : caster?.cls;
  const available = useSpells(managing && listKey, maxLevel, character?.edition);
  if (!character || !derived) return null;
  const { castAbility, magic, slots, pact, casters, spells, granted } = derived;
  const used = character.spellcasting.slotsUsed;
  const pactUsed = Math.min(pact?.count ?? 0, character.spellcasting.pactSlotsUsed);
  const held = character.spellcasting.spells;
  const levelOf = new Map(spells.map((s) => [s.key, s.level]));
  const firstKey = casters[0]?.cls.key;
  // Magias sem classe (fichas antigas) contam para a primeira classe conjuradora; as `free` não contam para ninguém.
  const ownerOf = (s: (typeof held)[number]) => s.classKey ?? firstKey;
  const mine = held.filter((s) => !s.free && ownerOf(s) === classKey);
  const prepared = new Map(mine.map((s) => [s.key, s.prepared]));
  const casterLevel = caster?.level ?? 1;

  const counts = caster?.counts ?? null;
  const mode: Mode = caster?.model ?? 'list';
  const prepareOpen = character.spellcasting.prepareOpen;
  const swapReady = (character.spellcasting.swaps[classKey ?? ''] ?? 0) < casterLevel;
  const st = spellState({ model: mode, counts, held: mine, levelOf: (k) => levelOf.get(k), casterLevel, prepareOpen, swapReady });
  const { cantripsHeld, leveledHeld, spellsCount, cantripCap, spellCap, bookCap, missingCantrips, missingSpells } = st;
  const spellsLabel = mode === 'known' ? 'Conhecidas' : 'Preparadas';

  const patch = (next: Partial<typeof character.spellcasting>) =>
    void save({ spellcasting: next }, (c) => ({ ...c, spellcasting: { ...c.spellcasting, ...next } }));
  const setUsed = (level: string, count: number) => patch({ slotsUsed: { ...used, [level]: count } });
  const setSpells = (list: typeof held) => patch({ spells: list });
  const mark = (key: string) => (s: (typeof held)[number]) => s.key === key && !s.free && ownerOf(s) === classKey;
  const add = (key: string, isPrepared: boolean) => setSpells([...held, { key, prepared: isPrepared, classKey: classKey ?? undefined }]);

  const lockHint =
    mode === 'known'
      ? swapReady
        ? 'Você pode trocar uma magia conhecida neste nível.'
        : 'Você já trocou uma magia neste nível; a próxima troca é ao subir de nível.'
      : prepareOpen
        ? 'Escolha as magias e confirme para fechar o preparo.'
        : 'O preparo troca só depois de um descanso longo (as vagas novas do nível podem ser preenchidas).';

  const longRest = () => {
    patch({ slotsUsed: {}, pactSlotsUsed: 0, prepareOpen: mode !== 'known' });
    if (mode !== 'known') setManaging(true);
  };
  const shortRest = () => patch({ pactSlotsUsed: 0 });
  const confirmPrepare = () => patch({ prepareOpen: false });
  /** Saída para quando o mestre libera uma troca fora da regra. */
  const unlock = () => patch({ prepareOpen: true, swaps: { ...character.spellcasting.swaps, ...(classKey ? { [classKey]: 0 } : {}) } });

  const forget = (key: string, spell?: SrdSpell) => {
    const next = held.filter((s) => !mark(key)(s));
    // Conhecidas: esquecer uma é a troca do nível.
    if (mode === 'known' && spell && classKey) patch({ spells: next, swaps: { ...character.spellcasting.swaps, [classKey]: casterLevel } });
    else setSpells(next);
  };
  const togglePrepared = (key: string) => {
    if (!st.canTogglePrepared(key)) return;
    setSpells(held.map((s) => (mark(key)(s) ? { ...s, prepared: !s.prepared } : s)));
  };
  const lockOf = st.lockOf;
  /** Ação de um toque na lista de escolha, conforme o modelo da classe. */
  const choose = (spell: SrdSpell) => {
    if (lockOf(spell)) return;
    if (prepared.has(spell.key)) return forget(spell.key, spell);
    add(spell.key, mode !== 'book' || spell.level === 0);
  };
  const actionLabel = (spell: SrdSpell) => {
    const has = prepared.has(spell.key);
    if (has) return mode === 'book' && spell.level > 0 ? 'Tirar do grimório' : mode === 'known' ? 'Trocar' : 'Remover';
    return mode === 'book' && spell.level > 0 ? 'Copiar' : mode === 'known' ? 'Aprender' : 'Preparar';
  };
  const blocked = (spell: SrdSpell) => lockOf(spell) !== null;

  /** Magias do personagem agrupadas por círculo, de uma classe ou as concedidas (talento, espécie…). */
  const groupBy = (list: typeof held) => {
    const map = new Map<number, SrdSpell[]>();
    for (const e of list) {
      const spell = spells.find((s) => s.key === e.key);
      if (spell) map.set(spell.level, [...(map.get(spell.level) ?? []), spell]);
    }
    return [...map.entries()].sort(([x], [y]) => x - y);
  };
  const preparedOf = (list: typeof held) => new Map(list.map((e) => [e.key, e.prepared]));
  const slotLevels = Object.keys(slots).sort();

  if (!castAbility && spells.length === 0 && !derived.spellsLoading) {
    return (
      <Panel title="Magias" icon="auto-fix">
        <Text style={[typography.body, { color: theme.textMuted }]}>Este personagem não conjura magias.</Text>
      </Panel>
    );
  }

  const circles = Array.from({ length: maxLevel + 1 }, (_, i) => i);
  const schools = caster?.schools ?? [];
  const inSchool = (s: SrdSpell) => !bySchool || schools.length === 0 || s.level === 0 || schools.includes(normalize(tr.text(s.school?.name ?? '')));
  const choices = available.status === 'ready' ? available.data.filter((s) => (circle === 'all' || s.level === circle) && inSchool(s)) : [];
  const modeHint =
    mode === 'list'
      ? 'Você prepara magias de toda a lista da classe e troca depois de um descanso longo.'
      : mode === 'book'
        ? 'Copie magias para o grimório e prepare algumas delas depois de um descanso longo.'
        : 'Você conhece um número fixo de magias; só troca uma ao subir de nível.';

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
              onChange={(n) => patch({ pactSlotsUsed: n })}
            />
          )}
          {isOwner && (
            <View style={styles.chips}>
              <SmallButton icon="weather-night" label="Descanso longo" onPress={longRest} />
              {pact && <SmallButton icon="campfire" label="Descanso curto" onPress={shortRest} />}
            </View>
          )}
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            Toque num espaço para gastar. O descanso longo devolve todos{pact ? ' (os de Pacto, marcados com P, também voltam no curto)' : ''}
            {mode === 'known' ? '.' : ' e abre a escolha de magias.'}
          </Text>
        </Panel>
      )}

      {counts && (
        <Panel title="Suas magias" icon="book-open-variant">
          <View style={styles.stats}>
            <StatBox label="Truques" value={`${cantripsHeld}/${cantripCap}`} accent={cantripsHeld > cantripCap} />
            {spellCap > 0 && <StatBox label={spellsLabel} value={`${spellsCount}/${spellCap}`} accent={spellsCount > spellCap} />}
            {mode === 'book' && <StatBox label="Grimório" value={`${leveledHeld.length}/${bookCap}`} />}
          </View>
          {casters.length > 1 && (
            <View style={styles.chips}>
              {casters.map((c, i) => (
                <Chip key={c.cls.key} label={tr.name(c.cls)} selected={c === caster} onPress={() => setCasterIndex(i)} />
              ))}
            </View>
          )}
          {(missingCantrips > 0 || missingSpells > 0) && (
            <Text style={[typography.caption, { color: theme.gold, fontWeight: '700' }]}>
              Faltam escolher:{' '}
              {[
                missingCantrips > 0 && `${missingCantrips} ${missingCantrips === 1 ? 'truque' : 'truques'}`,
                missingSpells > 0 && `${missingSpells} ${mode === 'known' ? 'magia' : 'preparada'}${missingSpells === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(' e ')}
              .
            </Text>
          )}
          {counts.formula && (
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              Preparadas = mod. de {abilityName(counts.formula.ability)} ({formatBonus(counts.formula.modifier)}) + {counts.formula.half ? 'metade do nível' : 'nível'} ({counts.formula.level}).
            </Text>
          )}
          <Text style={[typography.caption, { color: theme.textMuted }]}>{modeHint}</Text>
          <Text style={[typography.caption, { color: theme.textMuted }]}>{lockHint}</Text>
          {isOwner && mode !== 'known' && prepareOpen && <SmallButton icon="check" label="Confirmar preparo" tone="positive" onPress={confirmPrepare} />}
          {isOwner && !(mode === 'known' ? swapReady : prepareOpen) && <SmallButton icon="lock-open-variant-outline" label="Liberar troca" onPress={unlock} />}
          {isOwner && (
            <SmallButton
              icon={managing ? 'close' : 'book-edit-outline'}
              label={managing ? 'Fechar escolha' : mode === 'known' ? 'Escolher magias' : 'Preparar magias'}
              onPress={() => setManaging(!managing)}
            />
          )}
        </Panel>
      )}

      {managing && (
        <Panel title={`Lista de ${tr.name(listClass ?? caster?.cls ?? derived.cls)}`} icon="book-plus-outline">
          {casters.length > 1 && (
            <View style={styles.chips}>
              {casters.map((c, i) => (
                <Chip key={c.cls.key} label={tr.name(c.cls)} selected={c === caster} onPress={() => setCasterIndex(i)} />
              ))}
            </View>
          )}
          <View style={styles.chips}>
            <Chip label="Todas" selected={circle === 'all'} onPress={() => setCircle('all')} />
            {circles.map((n) => (
              <Chip key={n} label={n === 0 ? 'Truques' : `${n}º`} selected={circle === n} onPress={() => setCircle(n)} />
            ))}
          </View>
          {schools.length > 0 && (
            <Chip label={bySchool ? 'Só as escolas da subclasse' : 'Todas as escolas'} selected={bySchool} onPress={() => setBySchool(!bySchool)} />
          )}
          {available.status !== 'ready' ? (
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              {available.status === 'error' ? 'Não deu para carregar a lista.' : 'Carregando…'}
            </Text>
          ) : (
            choices.map((s) => {
              const has = prepared.has(s.key);
              return (
                <View key={s.key} style={[styles.learnRow, { borderColor: theme.border }]}>
                  <Text style={[typography.caption, styles.levelTag, { color: theme.gold }]}>{s.level === 0 ? 'T' : `${s.level}º`}</Text>
                  <Text style={[typography.body, styles.flex, { color: has ? theme.accent : theme.text }]}>{tr.name(s, 'spell')}</Text>
                  <SmallButton
                    icon={has ? 'minus' : 'plus'}
                    label={actionLabel(s)}
                    tone={has ? 'danger' : 'neutral'}
                    disabled={blocked(s)}
                    onPress={() => choose(s)}
                  />
                </View>
              );
            })
          )}
        </Panel>
      )}

      {derived.spellsLoading && (
        <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>Carregando magias…</Text>
      )}

      {casters.map((c) => {
        const own = held.filter((s) => !s.free && ownerOf(s) === c.cls.key);
        const isCurrent = c.cls.key === classKey;
        const groups = groupBy(own);
        if (groups.length === 0) return null;
        const map = preparedOf(own);
        return groups.map(([level, list]) => (
          <Panel
            key={`${c.cls.key}-${level}`}
            title={`${casters.length > 1 ? `${tr.name(c.cls)} · ` : ''}${LEVEL_LABEL(level)}`}
            icon={level === 0 ? 'creation' : 'book-open-variant'}
          >
            {list.map((spell) => (
              <SpellRow
                key={spell.key}
                spell={spell}
                prepared={level === 0 || (isCurrent && mode === 'known') ? null : (map.get(spell.key) ?? false)}
                onTogglePrepared={isOwner && managing && isCurrent && level > 0 && mode === 'book' ? () => togglePrepared(spell.key) : undefined}
                onForget={isOwner && managing && isCurrent && mode !== 'known' && (prepareOpen || mode === 'book') ? () => forget(spell.key) : undefined}
              />
            ))}
          </Panel>
        ));
      })}

      {[...groupBy(held.filter((s) => s.free)), ...(granted.length ? ([[-1, granted]] as [number, SrdSpell[]][]) : [])].map(([level, list]) => (
        <Panel key={`free-${level}`} title={level < 0 ? 'Sempre preparadas (subclasse)' : `Concedidas · ${LEVEL_LABEL(level)}`} icon="star-four-points-outline">
          {list.map((spell) => (
            <SpellRow key={spell.key} spell={spell} prepared={null} />
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
