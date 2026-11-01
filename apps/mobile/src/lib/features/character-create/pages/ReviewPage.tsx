import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, Character, proficiencyBonus } from '@dnf/core/character';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { isWeaponProficient, skillBonus, weaponAttack } from '@dnf/sdk/srd';
import { fonts, formatBonus, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { buildCharacter, startingHitPoints } from '../../features/character-create/build';
import { useCharacterDraft } from '../../features/character-create/draft';
import { buildInventory, inventoryArmorClass } from '../../features/character-create/inventory';
import {
  ABILITY_LABEL,
  alignmentLabel,
  classIcon,
  EDITION_INFO,
  skillLabel,
  type IconName,
} from '../../features/character-create/labels';
import { STEP_DEFS, type StepId } from '../../features/character-create/steps';
import { combined, useCreation } from '../../features/character-create/useCreation';
import { srd, tr, useSrd } from '../../lib/srd';

const PB = proficiencyBonus(1);

export default function ReviewPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const { reset } = useCharacterDraft();
  const c = useCreation();
  const { draft, klass, scores, items, skills, cls, species, speciesChain, background, languages } = c;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alignments = useSrd('alignments', () => srd.alignments());
  const spellKeys = [...draft.cantrips, ...draft.spells, ...draft.featCantrips, ...(draft.featSpell ? [draft.featSpell] : [])];
  const spells = useSrd(spellKeys.length ? `spellsByKey:${spellKeys.join(',')}` : null, () => srd.spellsByKey(spellKeys));

  const load = combined(c.queries.classQ, c.queries.itemsQ, c.queries.speciesQ);
  if (!klass || !scores || !items || !skills) {
    return (
      <StepScreen step="review" title="Tudo pronto?" canContinue={false}>
        <LoadState status={load.status === 'error' ? 'error' : 'loading'} onRetry={load.retry} />
      </StepScreen>
    );
  }

  const inventory = buildInventory(draft, klass, c.bg, items, scores);
  const ac = inventoryArmorClass(inventory, scores, klass);
  const hp = startingHitPoints(c);
  const input = buildCharacter(c, inventory);
  const ready = !!input && !!input.name;
  const alignment = alignments.status === 'ready' ? alignments.data.find((a) => a.key === draft.alignmentKey) : undefined;
  const lastSpecies = speciesChain.at(-1);
  const speciesName = lastSpecies ? tr.name(lastSpecies) : undefined;
  const proficientSkills = skills.filter((s) => c.allSkills.includes(s.key));

  async function create() {
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      const character = await Character.create(input);
      router.dismissTo('/');
      router.push(`/character/${character.id}`);
      reset();
    } catch (e) {
      setError(
        e instanceof ClientResponseError && e.status === 0
          ? 'Sem conexão com o servidor. Tente de novo.'
          : 'Não deu para salvar o personagem. Tente de novo.',
      );
      setSaving(false);
    }
  }

  const edit = (step: StepId) => router.navigate(STEP_DEFS.find((s) => s.id === step)!.href as Href);

  return (
    <StepScreen
      step="review"
      title="Tudo pronto?"
      subtitle="Confira a ficha. Toque em qualquer parte para voltar e mudar."
      canContinue={ready}
      continueLabel="Criar personagem"
      continueLoading={saving}
      onContinue={create}
    >
      <View style={[styles.hero, { backgroundColor: theme.surfaceRaised, borderColor: theme.gold }, shadow(theme, 2)]}>
        <View style={[styles.heroFrame, { pointerEvents: 'none' }, { borderColor: theme.goldSoft }]} />
        <View style={[styles.heroMedallion, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name={classIcon(cls?.name ?? '')} size={34} color={theme.accentText} />
        </View>
        <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={2}>
          {draft.name.trim() || 'Sem nome'}
        </Text>
        <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
          {[speciesName, cls && tr.name(cls), 'nível 1', background && tr.name(background)].filter(Boolean).join(' · ')}
        </Text>
        {draft.edition && (
          <Text style={[typography.overline, { color: theme.gold }]}>
            D&D {EDITION_INFO[draft.edition].title} · {alignment ? alignmentLabel(alignment.societal_attitude, alignment.morality) : 'sem alinhamento'}
          </Text>
        )}
      </View>

      <View style={styles.combat}>
        <Combat label="CA" value={String(ac.value)} icon="shield-half-full" />
        <Combat label="PV" value={String(hp ?? '—')} icon="heart" />
        <Combat label="Iniciativa" value={formatBonus(abilityModifier(scores.dex))} icon="lightning-bolt" />
        <Combat label="Desloc." value={(species?.speed || '—').replace(/\s*metros?$/i, ' m')} icon="run" />
        <Combat label="Prof." value={formatBonus(PB)} icon="star-four-points-outline" />
      </View>

      <Section title="Atributos e salvaguardas" onEdit={() => edit('abilities')}>
        <View style={styles.abilities}>
          {ABILITIES.map((a) => {
            const save = abilityModifier(scores[a]) + (klass.savingThrows.includes(a) ? PB : 0);
            return (
              <View key={a} style={[styles.ability, { borderColor: klass.savingThrows.includes(a) ? theme.gold : theme.border }]}>
                <Text style={[typography.overline, { color: theme.textMuted }]}>{ABILITY_LABEL[a].short}</Text>
                <Text style={[styles.abilityValue, { color: theme.text }]}>{scores[a]}</Text>
                <Text style={[typography.caption, { color: theme.gold, fontWeight: '800' }]}>
                  {formatBonus(abilityModifier(scores[a]))}
                </Text>
                <Text style={[styles.save, { color: theme.textMuted }]}>TR {formatBonus(save)}</Text>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Perícias" onEdit={() => edit('skills')}>
        <Text style={[typography.body, { color: theme.text }]}>
          {proficientSkills
            .map((s) => {
              const level = draft.expertise.includes(s.key) ? 'expertise' : 'proficient';
              return `${skillLabel(s.key, s.name)}${level === 'expertise' ? '★' : ''} ${formatBonus(skillBonus(s, scores, level, PB))}`;
            })
            .join(' · ') || '—'}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          Percepção passiva {10 + skillBonus(skills.find((s) => s.key === 'perception')!, scores, c.allSkills.includes('perception') ? (draft.expertise.includes('perception') ? 'expertise' : 'proficient') : undefined, PB)}
        </Text>
      </Section>

      <Section title="Equipamento" onEdit={() => edit('equipment')}>
        {inventory.items
          .filter((i) => i.item.weapon)
          .map((w) => {
            const attack = weaponAttack(w.item.weapon, scores, PB, isWeaponProficient(w.item.weapon!, klass.weaponTraining));
            return attack ? (
              <Text key={w.key} style={[typography.body, { color: theme.text }]}>
                ⚔ {tr.name(w.item, 'item')}: {formatBonus(attack.toHit)} para acertar, {attack.damage}{' '}
                {tr.text(attack.damageType).toLowerCase()}
              </Text>
            ) : null;
          })}
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          {[
            ...inventory.items.filter((i) => !i.item.weapon).map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${tr.name(i.item, 'item')}${i.equipped ? ' (vestido)' : ''}`),
            ...inventory.custom.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`),
            `${inventory.gp} po`,
          ].join(' · ')}
        </Text>
      </Section>

      {spellKeys.length > 0 && (
        <Section title="Magias" onEdit={() => edit('spells')}>
          <Text style={[typography.body, { color: theme.text }]}>
            {spells.status === 'ready'
              ? spells.data.map((s) => `${tr.name(s, 'spell')}${s.level === 0 ? ' (truque)' : ''}`).join(' · ')
              : 'Carregando…'}
          </Text>
        </Section>
      )}

      <Section title="Idiomas e talentos" onEdit={() => edit('details')}>
        <Text style={[typography.body, { color: theme.text }]}>
          {[
            ...c.fixedLanguages.map((l) => tr.name(l)),
            ...draft.languages.map((k) => {
              const language = languages?.find((l) => l.key === k);
              return language ? tr.name(language) : k;
            }),
          ].join(', ') || '—'}
        </Text>
        {(c.backgroundFeat || c.originFeat) && (
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            Talentos: {[c.backgroundFeat, c.originFeat].flatMap((f) => (f ? [tr.name(f)] : [])).join(', ')}
          </Text>
        )}
      </Section>

      {species && species.traits.length > 0 && (
        <Section title="Traços" onEdit={() => edit('species')}>
          <Text style={[typography.caption, { color: theme.text }]}>{species.traits.map((t) => tr.text(t.name)).join(' · ')}</Text>
        </Section>
      )}

      {error && (
        <View style={[styles.error, { borderColor: theme.negative }]} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.negative} />
          <Text style={[typography.caption, { color: theme.negative, flex: 1 }]}>{error}</Text>
        </View>
      )}
    </StepScreen>
  );
}

function Combat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  const theme = useRpgTheme();
  return (
    <View style={[styles.combatCell, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <MaterialCommunityIcons name={icon} size={16} color={theme.gold} />
      <Text style={[styles.combatValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.combatLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  const theme = useRpgTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <View style={styles.sectionHeader}>
        <SectionLabel>{title}</SectionLabel>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Editar ${title}`} hitSlop={8}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.accent} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  heroFrame: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderWidth: 1, borderRadius: radius.md },
  heroMedallion: { width: 68, height: 68, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  heroName: { ...typography.title, textAlign: 'center' },
  combat: { flexDirection: 'row', gap: spacing.xs },
  combatCell: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, gap: 2 },
  combatValue: { fontFamily: fonts.displayHeavy, fontSize: 20 },
  combatLabel: { fontSize: 11, fontWeight: '600' },
  section: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abilities: { flexDirection: 'row', gap: spacing.xs },
  ability: { flex: 1, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', paddingVertical: spacing.sm },
  abilityValue: { fontFamily: fonts.displayHeavy, fontSize: 20, lineHeight: 26 },
  save: { fontSize: 10, fontWeight: '700' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
