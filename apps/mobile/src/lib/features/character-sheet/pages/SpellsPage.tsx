import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, DnfSpinner, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { SpellBook } from '../components/sections/Spells';
import { useSheet } from '../functions/useSheet';

/** Tela de magias do personagem: espaços, descansos, truques, magias preparadas ou conhecidas e a lista da classe. */
export default function SpellsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useRpgTheme();
  const router = useRouter();
  const sheet = useSheet(id);
  const exit = () => (router.canGoBack() ? router.back() : router.replace(`/character/${id}`));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={exit} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[typography.heading, { color: theme.text }]} numberOfLines={1}>
            Magias
          </Text>
          {sheet.character && (
            <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
              {sheet.character.name}
              {!sheet.isOwner ? ' · somente leitura' : ''}
            </Text>
          )}
        </View>
      </View>
      {sheet.status === 'loading' || (sheet.status === 'ready' && !sheet.derived) ? (
        <View style={styles.center}>
          {sheet.srdFailed ? <Button label="Tentar de novo" variant="secondary" onPress={sheet.retrySrd} /> : <DnfSpinner size={44} />}
        </View>
      ) : sheet.status !== 'ready' ? (
        <View style={styles.center}>
          <Text style={[typography.bodyStrong, { color: theme.text }]}>Não deu para abrir as magias</Text>
          <Button label="Voltar" variant="secondary" onPress={exit} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SpellBook sheet={sheet} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, width: '100%', maxWidth: 760, alignSelf: 'center' },
});
