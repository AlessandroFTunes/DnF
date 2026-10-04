import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mesa } from '@dnf/core/mesa';
import { DiferenteKey } from '@dnf/core/util';
import { Button, fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { EDITION_INFO } from '../../features/character-create/labels';

/** Mestre cria a mesa: nome, edição e um recado para os jogadores. */
export default function NewMesaPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [edition, setEdition] = useState<DiferenteKey.Edition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!edition || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const mesa = await Mesa.create({ name: name.trim(), edition, description: description.trim() });
      router.replace(`/mesa/${mesa.id}`);
    } catch {
      setError('Não deu para criar a mesa. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          >
            <MaterialCommunityIcons name="close" size={22} color={theme.text} />
          </Pressable>
          <Text style={[typography.overline, { color: theme.textMuted }]}>Nova mesa</Text>
          <View style={styles.iconSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <MaterialCommunityIcons name="crown-outline" size={36} color={theme.gold} />
            <Text style={[typography.title, { color: theme.text }]}>Seja o mestre</Text>
            <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
              Crie a mesa e compartilhe o código. Você acompanha a ficha e os PV de todo o grupo.
            </Text>
          </View>

          <Text style={[typography.overline, { color: theme.textMuted }]}>Nome da mesa</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: A Mina Perdida de Phandelver"
            placeholderTextColor={theme.textMuted}
            maxLength={64}
            accessibilityLabel="Nome da mesa"
            style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />

          <Text style={[typography.overline, { color: theme.textMuted }]}>Edição das regras</Text>
          <View style={styles.editions}>
            {DiferenteKey.EDITIONS.map((e) => {
              const selected = edition === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => setEdition(e)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`D&D ${e}`}
                  style={[
                    styles.edition,
                    { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised },
                    selected && shadow(theme, 2),
                  ]}
                >
                  <Text style={[styles.year, { color: selected ? theme.accent : theme.text }]}>{e}</Text>
                  <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>{EDITION_INFO[e].subtitle}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[typography.overline, { color: theme.textMuted }]}>Recado para os jogadores (opcional)</Text>
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

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button
            label="Criar mesa"
            onPress={() => void create()}
            disabled={!edition || !name.trim()}
            loading={saving}
            icon={(c) => <MaterialCommunityIcons name="castle" size={18} color={c} />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconSpacer: { width: 40 },
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  heading: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  nameInput: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, fontFamily: fonts.display, fontSize: 18 },
  editions: { flexDirection: 'row', gap: spacing.md },
  edition: { flex: 1, borderWidth: 2, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  year: { fontFamily: fonts.displayHeavy, fontSize: 32 },
  description: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
