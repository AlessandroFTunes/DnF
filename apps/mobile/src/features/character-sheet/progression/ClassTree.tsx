import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES } from '@dnf/core/character';
import { fightingStyleSlots, plainText } from '@dnf/sdk/srd';
import { Button, Chip, fonts, radius, spacing } from '@dnf/ui-react-native';
import { ABILITY_LABEL } from '../../character-create/labels';
import type { LevelUpGain } from '../LevelUpCelebration';
import type { Sheet, SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';
import { branchesOf, buildNodes, starsOf, subclassLabel, type TreeEntry } from './nodes';
import { MAX_LEVEL, SKY } from './sky';
import { Tree } from './Tree';
import { useLevelUp, type LevelUp } from './useLevelUp';

/** Habilidades do nível recém-ganho: brilham até o jogador tocar nelas. */
export interface Fresh {
  level: number;
  seen: string[];
}

/**
 * Árvore da classe do personagem. Subir de nível acontece nela mesma: as estrelas do próximo nível brilham
 * e as escolhas (PV, atributo, subclasse) são feitas tocando nelas.
 */
export function ClassTree({
  sheet,
  derived,
  fresh,
  onSeen,
  onLevelUp,
}: {
  sheet: Sheet;
  derived: SheetData;
  fresh: Fresh | null;
  onSeen: (id: string) => void;
  onLevelUp: (level: number, gains: LevelUpGain[]) => void;
}) {
  const level = sheet.character!.level;
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(windowWidth - 32, 820));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const up = useLevelUp(sheet, derived);
  const hasSubclasses = derived.subclasses.length > 0;

  const classStars = useMemo(
    () => starsOf(derived.cls, derived.asiLevels, hasSubclasses ? derived.subclassLevel : null),
    [derived.cls, derived.asiLevels, derived.subclassLevel, hasSubclasses],
  );
  const branches = useMemo(() => branchesOf(derived.subclasses), [derived.subclasses]);
  const trunk = useMemo(() => (up.active ? [...classStars, up.hpStar] : classStars), [classStars, up.active, up.hpStar]);
  const chosenKey = derived.subclass?.key ?? (up.active ? up.pendingSubclass : null);

  const entries = useMemo(() => {
    const map = new Map<string, TreeEntry>();
    for (const star of trunk) map.set(star.id, { star, branch: null });
    for (const branch of branches) for (const star of branch.stars) map.set(star.id, { star, branch });
    return map;
  }, [trunk, branches]);

  // O que brilha: subindo, o que o próximo nível dá; depois de subir, o que acabou de ganhar.
  const glowing = useMemo(() => {
    const ids = [...entries.values()]
      .filter(({ branch }) => !branch || branch.sub.key === chosenKey)
      .filter(({ star }) =>
        up.active ? star.level === up.next : fresh ? star.level === fresh.level && !fresh.seen.includes(star.id) : false,
      )
      .map(({ star }) => star.id);
    return new Set(ids);
  }, [entries, chosenKey, up.active, up.next, fresh]);

  const nodes = useMemo(
    () => buildNodes({ trunk, branches, level, chosenKey, choosing: up.choosing, glowing }),
    [trunk, branches, level, chosenKey, up.choosing, glowing],
  );

  const select = useCallback(
    (id: string) => {
      setSelectedId((current) => (current === id ? null : id));
      onSeen(id);
    },
    [onSeen],
  );

  const selected = selectedId ? entries.get(selectedId) : undefined;

  async function confirm() {
    const gains = await up.confirm();
    if (gains) onLevelUp(up.next, gains);
  }

  const hint = up.active
    ? up.missing.length
      ? `Nível ${up.next}: toque nas estrelas brilhando para escolher ${up.missing.join(' e ')}.`
      : `Tudo escolhido. Confirme o nível ${up.next}.`
    : glowing.size > 0
      ? 'As estrelas brilhando são suas novas habilidades. Toque para ler.'
      : derived.subclassesLoading
        ? 'Carregando as subclasses…'
        : 'Toque numa estrela para ler a habilidade.';

  const canLevel = sheet.isOwner && level < MAX_LEVEL;

  return (
    <View style={styles.sky} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <View style={styles.header}>
        <View style={styles.legendary}>
          <Text style={styles.legendaryText}>
            {tr.name(derived.cls).toUpperCase()} · NÍVEL {up.active ? `${level} → ${up.next}` : level}
          </Text>
        </View>
      </View>
      {derived.subclass && <Text style={styles.subclassName}>{subclassLabel(derived.subclass)}</Text>}
      {!up.active && <Text style={styles.hint}>{hint}</Text>}

      <Tree
        width={width}
        nodes={nodes}
        selectedId={selectedId}
        onSelect={select}
        action={
          canLevel
            ? {
                beforeLevel: up.next,
                content: up.active ? (
                  <ConfirmBar up={up} hint={hint} onCancel={() => (up.cancel(), setSelectedId(null))} onConfirm={() => void confirm()} />
                ) : (
                  <Pressable
                    onPress={up.start}
                    accessibilityRole="button"
                    accessibilityLabel={`Subir para o nível ${up.next}`}
                    style={styles.actionGhost}
                  >
                    <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={18} color={SKY.star} />
                    <Text style={styles.actionGhostText}>Subir para o nível {up.next}</Text>
                  </Pressable>
                ),
              }
            : null
        }
        popover={
          selected && (
            <StarCard
              entry={selected}
              unlocked={selected.star.level <= level && (!selected.branch || selected.branch.sub.key === derived.subclass?.key)}
              onClose={() => setSelectedId(null)}
            >
              <Choices
                entry={selected}
                up={up}
                sheet={sheet}
                derived={derived}
                unlocked={selected.star.level <= level && (!selected.branch || selected.branch.sub.key === derived.subclass?.key)}
              />
            </StarCard>
          )
        }
      />
    </View>
  );
}

function ConfirmBar({ up, hint, onCancel, onConfirm }: { up: LevelUp; hint: string; onCancel: () => void; onConfirm: () => void }) {
  const disabled = !up.ready || up.saving;
  return (
    <View style={styles.action}>
      <View style={styles.actionButtons}>
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.actionSecondary}>
          <MaterialCommunityIcons name="close" size={16} color={SKY.muted} />
          <Text style={styles.actionSecondaryText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Confirmar nível ${up.next}`}
          style={[styles.actionPrimary, { opacity: disabled ? 0.45 : 1 }]}
        >
          <MaterialCommunityIcons name="check-bold" size={16} color={SKY.bg} />
          <Text style={styles.actionPrimaryText}>{up.saving ? 'Salvando…' : `Confirmar nível ${up.next}`}</Text>
        </Pressable>
      </View>
      <Text style={styles.actionHint}>{hint}</Text>
    </View>
  );
}

/** Escolhas dentro do painel da estrela: PV, atributo e subclasse (subindo de nível) e Estilo de Luta. */
function Choices({
  entry,
  up,
  sheet,
  derived,
  unlocked,
}: {
  entry: TreeEntry;
  up: LevelUp;
  sheet: Sheet;
  derived: SheetData;
  unlocked: boolean;
}) {
  const { star, branch } = entry;
  if (star.choice === 'fightingStyle') {
    if (up.choosingStyle && star.level === up.next) return <FightingStyleChoice up={up} sheet={sheet} derived={derived} />;
    if (unlocked && sheet.isOwner && !up.active) return <FightingStyleChoice sheet={sheet} derived={derived} />;
    return null;
  }
  if (star.kind === 'hp') {
    return (
      <View style={styles.chips}>
        <Chip label={`Média: ${up.average}`} selected={up.hpMode === 'average'} onPress={up.useAverage} />
        <Chip
          label={up.rolled === null ? `Rolar d${derived.hitDie}` : `Rolou ${up.rolled} (de novo)`}
          selected={up.hpMode === 'roll'}
          onPress={up.roll}
          icon={(c) => <MaterialCommunityIcons name="dice-d20-outline" size={14} color={c} />}
        />
      </View>
    );
  }
  if (star.kind === 'asi' && up.isAsi && star.level === up.next) {
    return (
      <>
        <View style={styles.chips}>
          <Chip label="+2 em um" selected={up.asiMode === 'two'} onPress={() => up.setAsiMode('two')} />
          <Chip label="+1 em dois" selected={up.asiMode === 'oneOne'} onPress={() => up.setAsiMode('oneOne')} />
        </View>
        <View style={styles.chips}>
          {ABILITIES.map((a) => (
            <Chip
              key={a}
              label={`${ABILITY_LABEL[a].short} ${derived.scores[a]}`}
              selected={up.asiPicks.includes(a)}
              disabled={derived.scores[a] >= 20}
              onPress={() => up.toggleAsi(a)}
            />
          ))}
        </View>
      </>
    );
  }
  if (up.choosing && branch) {
    return branch.sub.key === up.pendingSubclass ? (
      <Text style={[styles.cardNote, { color: branch.color }]}>✦ Subclasse escolhida</Text>
    ) : (
      <Button label={`Escolher ${tr.name(branch.sub)}`} onPress={() => up.setPendingSubclass(branch.sub.key)} />
    );
  }
  return null;
}

/**
 * Talentos de Estilo de Luta. Subindo de nível (`up`), a escolha fica pendente até confirmar; fora disso,
 * tocar já salva (troca o estilo, ou completa um que ficou sem escolher).
 */
function FightingStyleChoice({ up, sheet, derived }: { up?: LevelUp; sheet: Sheet; derived: SheetData }) {
  const character = sheet.character!;
  const options = derived.fightingStyles;
  const owned = character.featKeys.filter((k) => options.some((f) => f.key === k));
  const slots = fightingStyleSlots([derived.cls, derived.subclass], character.level);
  const picked = up ? up.pendingStyle : null;
  const focusKey = picked ?? owned.at(-1) ?? null;
  const focus = options.find((f) => f.key === focusKey);

  if (options.length === 0) return <Text style={[styles.cardNote, { color: SKY.muted }]}>Os talentos de Estilo de Luta ainda não estão no compêndio.</Text>;

  const saveStyles = (keys: string[]) => {
    const featKeys = [...character.featKeys.filter((k) => !owned.includes(k)), ...keys];
    void sheet.save({ featKeys }, (c) => ({ ...c, featKeys }));
  };

  function toggle(key: string) {
    if (up) return up.setPendingStyle(up.pendingStyle === key ? null : key);
    if (owned.includes(key)) return saveStyles(owned.filter((k) => k !== key));
    // Com as vagas cheias, a escolha troca o último estilo (com uma vaga só, é a troca do estilo).
    saveStyles(owned.length < slots ? [...owned, key] : [...owned.slice(0, slots - 1), key]);
  }

  return (
    <>
      <Text style={[styles.cardNote, { color: SKY.star }]}>
        {up
          ? 'Escolha o estilo de luta deste nível.'
          : owned.length < slots
            ? `Escolha ${slots - owned.length === 1 ? 'um estilo' : `${slots - owned.length} estilos`} de luta.`
            : 'Toque em outro estilo para trocar.'}
      </Text>
      <View style={styles.chips}>
        {options
          // Subindo de nível, um estilo que o personagem já tem não pode ser escolhido de novo.
          .filter((f) => !up || !owned.includes(f.key))
          .map((f) => (
            <Chip key={f.key} label={tr.name(f)} selected={up ? picked === f.key : owned.includes(f.key)} onPress={() => toggle(f.key)} />
          ))}
      </View>
      {focus && (
        <Text style={styles.cardText}>
          {[tr.desc(focus), ...focus.benefits.map((b, i) => tr.field(focus.key, `benefit:${i}`, b.desc))].filter(Boolean).map(plainText).join('\n')}
        </Text>
      )}
    </>
  );
}

/** Painel da estrela tocada: aparece ao lado dela, com a descrição e (subindo de nível) a escolha. */
function StarCard({
  entry,
  unlocked,
  onClose,
  children,
}: {
  entry: TreeEntry;
  unlocked: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { star, branch } = entry;
  return (
    <View style={[styles.card, branch && { borderColor: branch.color }]}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          {branch && <Text style={[styles.cardBranch, { color: branch.color }]}>{subclassLabel(branch.sub).toUpperCase()}</Text>}
          <Text style={styles.cardTitle}>{star.name}</Text>
          <Text style={styles.cardLevel}>
            {star.levels.length > 1 ? `Níveis ${star.levels.join(', ')}` : `Nível ${star.level}`}
            {unlocked ? ' · desbloqueada' : ''}
            {star.original ? ` · ${star.original}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
          <MaterialCommunityIcons name="close" size={18} color={SKY.muted} />
        </Pressable>
      </View>
      {children}
      <ScrollView style={styles.cardScroll} nestedScrollEnabled>
        <Text style={styles.cardText}>{plainText(star.desc)}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sky: { backgroundColor: SKY.bg, borderRadius: radius.lg, overflow: 'hidden', paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  legendary: {
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.5)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  legendaryText: { color: SKY.text, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2 },
  subclassName: { color: SKY.sub, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 1.5, textAlign: 'center', marginTop: spacing.xs },
  hint: { color: SKY.muted, fontSize: 13, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  action: { alignItems: 'center', gap: 6 },
  actionButtons: { flexDirection: 'row', gap: spacing.sm },
  actionGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.bg,
  },
  actionGhostText: { color: SKY.star, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(154,160,190,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.bg,
  },
  actionSecondaryText: { color: SKY.muted, fontSize: 13, fontWeight: '700' },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.star,
  },
  actionPrimaryText: { color: SKY.bg, fontSize: 13, fontWeight: '800' },
  actionHint: {
    color: SKY.star,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 320,
    paddingHorizontal: spacing.md,
    backgroundColor: SKY.bg,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.55)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(10,12,26,0.96)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardBranch: { fontFamily: fonts.displayMedium, fontSize: 10, letterSpacing: 1.5 },
  cardTitle: { color: SKY.star, fontFamily: fonts.display, fontSize: 17 },
  cardLevel: { color: SKY.muted, fontSize: 12 },
  cardNote: { fontSize: 13, fontWeight: '700' },
  cardScroll: { maxHeight: 170 },
  cardText: { color: SKY.text, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
