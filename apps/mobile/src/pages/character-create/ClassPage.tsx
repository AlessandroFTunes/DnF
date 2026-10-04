import { MaterialCommunityIcons } from '@expo/vector-icons';
import { featuresByLevel, plainText } from '@dnf/sdk/srd';
import { OptionCard } from '@dnf/ui-react-native';
import { InfoRow, LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { abilityName, CASTER_LABEL, classIcon, skillLabel, subclassOrigin } from '../../features/character-create/labels';
import { useCreation } from '../../features/character-create/useCreation';
import { srd, tr, useSrd } from '../../lib/srd';

export default function ClassPage() {
  const { draft, setClass, update } = useCharacterDraft();
  const { klass, skills, queries, subclasses, subclassAtLevel1 } = useCreation();
  const subclassesLoading = !!draft.classKey && queries.subclassesQ.status === 'loading';
  const edition = draft.edition;
  const classes = useSrd(edition && `classes:${edition}`, () => srd.classes(edition!));
  const chosen = classes.status === 'ready' ? classes.data.find((c) => c.key === draft.classKey) : undefined;

  return (
    <StepScreen
      step="class"
      title="Escolha sua classe"
      subtitle="A classe define seu papel no grupo: como você luta, conjura e sobrevive."
      canContinue={draft.classKey !== null && klass !== null && !subclassesLoading && (!subclassAtLevel1 || !!draft.subclassKey)}
    >
      {classes.status !== 'ready' ? (
        <LoadState status={classes.status} onRetry={classes.retry} />
      ) : (
        classes.data.map((c) => {
          const selected = draft.classKey === c.key;
          return (
            <OptionCard
              key={c.key}
              title={tr.name(c)}
              subtitle={[`Dado de vida ${c.hit_dice?.toLowerCase() ?? '—'}`, c.caster_type && CASTER_LABEL[c.caster_type]]
                .filter(Boolean)
                .join(' · ')}
              selected={selected}
              onPress={() => setClass(c.key)}
              leading={(color) => <MaterialCommunityIcons name={classIcon(c.key)} size={24} color={color} />}
            >
              {selected && !klass ? (
                <LoadState
                  status={queries.classQ.status === 'error' ? 'error' : 'loading'}
                  onRetry={queries.classQ.retry}
                />
              ) : klass ? (
                <>
                  <InfoRow
                    icon="heart-pulse"
                    label="PV no 1º nível"
                    value={`${klass.hitDie} + modificador de Constituição`}
                  />
                  <InfoRow
                    icon="shield-half-full"
                    label="Salvaguardas"
                    value={klass.savingThrows.map(abilityName).join(' e ') || '—'}
                  />
                  <InfoRow
                    icon="star-four-points-outline"
                    label={`Perícias (escolha ${klass.skillChoice.count})`}
                    value={
                      klass.skillChoice.options
                        ? klass.skillChoice.options
                            .map((k) => skillLabel(k, skills?.find((s) => s.key === k)?.name))
                            .join(', ')
                        : 'Qualquer perícia'
                    }
                  />
                  <InfoRow icon="shield-outline" label="Armaduras" value={klass.armorTraining || 'Nenhuma'} />
                  <InfoRow icon="sword" label="Armas" value={klass.weaponTraining || '—'} />
                  {klass.toolTraining && !/^none$/i.test(klass.toolTraining) ? (
                    <InfoRow icon="hammer" label="Ferramentas" value={klass.toolTraining} />
                  ) : null}
                  {subclasses.length > 0 && !subclassAtLevel1 ? (
                    <InfoRow
                      icon="source-branch"
                      label={`Subclasses (${subclasses.length}, escolha ao subir de nível)`}
                      value={subclasses.map((sub) => tr.name(sub)).join(', ')}
                    />
                  ) : null}
                  {klass.spellcasting ? (
                    <InfoRow
                      icon="auto-fix"
                      label="Conjuração"
                      value={[
                        abilityName(klass.spellcasting.ability),
                        klass.spellcasting.cantrips ? `${klass.spellcasting.cantrips} truques` : null,
                        klass.spellcasting.slots ? `${klass.spellcasting.slots} espaços de 1º círculo` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  ) : null}
                </>
              ) : null}
            </OptionCard>
          );
        })
      )}

      {subclassAtLevel1 && (
        <>
          <SectionLabel>{`Subclasse de ${chosen ? tr.name(chosen) : ''} · escolhida no 1º nível`}</SectionLabel>
          {subclasses.map((sub) => {
            const level1 = featuresByLevel(sub).get(1) ?? [];
            const origin = subclassOrigin(sub);
            return (
              <OptionCard
                key={sub.key}
                title={tr.name(sub)}
                subtitle={[origin, level1.length ? `1º nível: ${level1.map((f) => tr.name(f)).join(', ')}` : null].filter(Boolean).join(' · ')}
                selected={draft.subclassKey === sub.key}
                onPress={() => update({ subclassKey: sub.key })}
                leading={(color) => <MaterialCommunityIcons name="source-branch" size={22} color={color} />}
              >
                {level1.map((f) => (
                  <InfoRow key={f.key} icon="star-four-points-outline" label={tr.name(f)} value={plainText(f.desc).slice(0, 240)} />
                ))}
              </OptionCard>
            );
          })}
        </>
      )}
    </StepScreen>
  );
}
