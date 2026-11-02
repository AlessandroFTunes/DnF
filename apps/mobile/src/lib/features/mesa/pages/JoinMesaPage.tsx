import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Mesa } from '@dnf/core/mesa';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { Button, DnfSpinner, fonts, OptionCard, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { FooterBar, Header, HighlightCard, PageHeading, SectionLabel } from '../../../components';
import { classIcon } from '../../character-create/functions/labels';
import { formatCode } from '../functions/code';
import { useClasses } from '../../srd/functions';
import { useCharacters } from '../../character-sheet/functions/queries';
import { useFindMesa, useJoinMesa } from '../functions/queries';

/** Jogador entra numa mesa: digita o código, vê a mesa e escolhe o personagem da mesma edição. */
export default function JoinMesaPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ characterID?: string; code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [mesa, setMesa] = useState<Mesa.Info | null>(null);
  const charactersQ = useCharacters();
  const characters = charactersQ.status === 'ready' ? charactersQ.data : charactersQ.status === 'error' ? [] : null;
  const findMesa = useFindMesa();
  const joinMesa = useJoinMesa();
  const [characterID, setCharacterID] = useState<string | null>(params.characterID ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nome das classes (em cache) para o ícone de cada personagem.
  const classes = useClasses(mesa?.edition);
  const className = (key = '') => (classes.status === 'ready' ? classes.data.find((k) => k.key === key)?.name : undefined) ?? '';

  const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);

  async function find() {
    setBusy(true);
    setError(null);
    try {
      const found = await findMesa(clean);
      if (!found) setError('Nenhuma mesa com esse código. Confira com o mestre.');
      setMesa(found);
    } catch {
      setError('Não deu para buscar a mesa. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!mesa || !characterID) return;
    setBusy(true);
    setError(null);
    try {
      await joinMesa({ inviteCode: clean, characterID });
      router.replace(`/mesa/${mesa.id}`);
    } catch (e) {
      setError(
        e instanceof ClientResponseError && e.status === 400
          ? 'Esse personagem já está nesta mesa (ou não é da mesma edição).'
          : 'Não deu para entrar na mesa. Tente de novo.',
      );
      setBusy(false);
    }
  }

  const eligible = (characters ?? []).filter((c) => !mesa || c.edition === mesa.edition);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header action={{ kind: 'close', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }} title="Entrar numa mesa" />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageHeading icon="door-open" title="Código do mestre" />

          <TextInput
            value={clean.length > 4 ? formatCode(clean) : clean}
            onChangeText={(v) => {
              setCode(v);
              setMesa(null);
            }}
            placeholder="XXXX-XXXX"
            placeholderTextColor={theme.border}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            accessibilityLabel="Código de convite"
            onSubmitEditing={() => clean.length === 8 && void find()}
            style={[styles.code, { color: theme.accent, borderColor: theme.gold, backgroundColor: theme.surfaceRaised }]}
          />
          {!mesa && (
            <Button
              label="Procurar mesa"
              onPress={() => void find()}
              disabled={clean.length !== 8}
              loading={busy}
              icon={(c) => <MaterialCommunityIcons name="magnify" size={18} color={c} />}
            />
          )}

          {mesa && (
            <>
              <HighlightCard>
                <MaterialCommunityIcons name="castle" size={28} color={theme.gold} />
                <View style={styles.flex}>
                  <Text style={[typography.heading, { color: theme.text }]}>{mesa.name}</Text>
                  <Text style={[typography.caption, { color: theme.textMuted }]}>D&D {mesa.edition}</Text>
                  {mesa.description ? <Text style={[typography.caption, { color: theme.text }]}>{mesa.description}</Text> : null}
                </View>
              </HighlightCard>

              <SectionLabel>Com qual personagem?</SectionLabel>
              {characters === null ? (
                <DnfSpinner size={36} />
              ) : eligible.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
                    Você não tem personagem de D&D {mesa.edition}. Crie um e volte com o código.
                  </Text>
                  <Button label="Criar personagem" variant="secondary" onPress={() => router.push('/character/new')} />
                </View>
              ) : (
                eligible.map((c) => (
                  <OptionCard
                    key={c.id}
                    title={c.name}
                    subtitle={`Nível ${c.level} · PV ${c.combat.hpCurrent}/${c.combat.hpMax}`}
                    selected={characterID === c.id}
                    onPress={() => setCharacterID(c.id)}
                    leading={(color) => <MaterialCommunityIcons name={classIcon(className(c.classes[0]?.classKey))} size={22} color={color} />}
                  />
                ))
              )}
            </>
          )}
          {error && <Text style={[typography.caption, { color: theme.negative, textAlign: 'center' }]}>{error}</Text>}
        </ScrollView>

        {mesa && eligible.length > 0 && (
          <FooterBar>
            <Button
              label="Sentar à mesa"
              onPress={() => void join()}
              disabled={!characterID || !eligible.some((c) => c.id === characterID)}
              loading={busy}
              icon={(c) => <MaterialCommunityIcons name="sword-cross" size={18} color={c} />}
              style={styles.flex}
            />
          </FooterBar>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  code: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.displayHeavy,
    fontSize: 34,
    letterSpacing: 4,
  },
  empty: { gap: spacing.md },
});
