import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DiferenteKey } from '@dnf/core/util';
import { Button, fonts, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { FooterBar, Header, PageHeading, SectionLabel, TilePicker } from '../../../components';
import { EDITION_INFO } from '../../character-create/functions/labels';
import { useCreateMesa } from '../functions/queries';

/** Mestre cria a mesa: nome, edição e um recado para os jogadores. */
export default function NewMesaPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [edition, setEdition] = useState<DiferenteKey.Edition | null>(null);
  const createMesa = useCreateMesa();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!edition || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const mesa = await createMesa({ name: name.trim(), edition, description: description.trim() });
      router.replace(`/mesa/${mesa.id}`);
    } catch {
      setError('Não deu para criar a mesa. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header action={{ kind: 'close', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }} title="Nova mesa" />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageHeading
            icon="crown-outline"
            title="Seja o mestre"
            subtitle="Crie a mesa e compartilhe o código. Você acompanha a ficha e os PV de todo o grupo."
          />

          <SectionLabel>Nome da mesa</SectionLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: A Mina Perdida de Phandelver"
            placeholderTextColor={theme.textMuted}
            maxLength={64}
            accessibilityLabel="Nome da mesa"
            style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />

          <SectionLabel>Edição das regras</SectionLabel>
          <TilePicker
            value={edition}
            onChange={setEdition}
            options={DiferenteKey.EDITIONS.map((e) => ({ value: e, label: e, caption: EDITION_INFO[e].subtitle }))}
          />

          <SectionLabel>Recado para os jogadores (opcional)</SectionLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Sessões às sextas, 20h. Personagens de nível 1."
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={2000}
            accessibilityLabel="Descrição da mesa"
            style={[styles.description, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />

          {error && <Text style={[typography.caption, { color: theme.negative }]}>{error}</Text>}
        </ScrollView>

        <FooterBar>
          <Button
            label="Criar mesa"
            onPress={() => void create()}
            disabled={!edition || !name.trim()}
            loading={saving}
            icon={(c) => <MaterialCommunityIcons name="castle" size={18} color={c} />}
            style={styles.flex}
          />
        </FooterBar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  nameInput: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, fontFamily: fonts.display, fontSize: 18 },
  description: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
});
