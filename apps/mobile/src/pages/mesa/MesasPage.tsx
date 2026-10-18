import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mesa } from '@dnf/core/mesa';
import { Button, DnfSpinner, radius, type RpgTheme, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../../hooks/hook.session';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Mesa.Info[] };

/** Lista de mesas do jogador (aberta pelo nav da Home). */
export default function MesasPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const [tables, setTables] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const userID = session.status === 'signedIn' ? session.session.userID : null;

  const fetchTables = useCallback(async () => {
    await Mesa.list({ pageSize: 100 }).then(
      (page) => setTables({ status: 'ready', data: page.data }),
      () => setTables((current) => (current.status === 'ready' ? current : { status: 'error' })),
    );
  }, []);

  // Recarrega ao voltar para a tela (ex.: depois de criar ou entrar numa mesa).
  useFocusEffect(
    useCallback(() => {
      void fetchTables();
    }, [fetchTables]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchTables();
    setRefreshing(false);
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[typography.heading, { color: theme.text }]} accessibilityRole="header">
          Mesas
        </Text>
        <View style={styles.iconButton} />
      </View>

      {tables.status === 'loading' && (
        <View style={styles.center}>
          <DnfSpinner size={56} />
        </View>
      )}

      {tables.status === 'error' && (
        <View style={styles.center}>
          <Text style={[typography.heading, styles.centered, { color: theme.text }]}>Não deu para carregar</Text>
          <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>Confira sua conexão e tente de novo.</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={fetchTables} />
        </View>
      )}

      {tables.status === 'ready' && (
        <FlatList
          data={tables.data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, tables.data.length === 0 && styles.flexGrow]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
          ListHeaderComponent={
            tables.data.length ? (
              <Text style={[typography.overline, { color: theme.textMuted }]}>Suas mesas · {tables.data.length}</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialCommunityIcons name="castle" size={64} color={theme.gold} />
              <Text style={[typography.heading, styles.centered, { color: theme.text }]}>Nenhuma mesa ainda</Text>
              <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>
                Peça o código ao mestre para entrar, ou crie uma mesa e chame seus amigos.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MesaCard theme={theme} mesa={item} isGM={item.gmID === userID} onPress={() => router.push(`/mesa/${item.id}`)} />
          )}
        />
      )}

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
        <Button
          label="Entrar com código"
          onPress={() => router.push('/mesa/join')}
          style={styles.flex}
          icon={(color) => <MaterialCommunityIcons name="door-open" size={20} color={color} />}
        />
        <Button
          label="Criar mesa"
          variant="secondary"
          onPress={() => router.push('/mesa/new')}
          icon={(color) => <MaterialCommunityIcons name="crown-outline" size={20} color={color} />}
        />
      </View>
    </SafeAreaView>
  );
}

function MesaCard({ theme, mesa, isGM, onPress }: { theme: RpgTheme; mesa: Mesa.Info; isGM: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir mesa ${mesa.name}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        shadow(theme, 1),
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: isGM ? theme.gold : theme.surfaceSunken }]}>
        <MaterialCommunityIcons name={isGM ? 'crown-outline' : 'castle'} size={24} color={isGM ? theme.surface : theme.gold} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[typography.subheading, { color: theme.text }]} numberOfLines={1}>
          {mesa.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
          {isGM ? 'Você é o mestre' : 'Você é jogador'} · D&D {mesa.edition}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  centered: { textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
