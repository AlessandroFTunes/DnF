import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { FooterBar, Header, ListCard, LoadState } from '../../../components';
import { useSession } from '../../auth/functions/hook.session';
import { useRefetchOnFocus } from '../../../query-state';
import { mesaKeys, useMesas } from '../functions/queries';

/** Lista de mesas do jogador (aberta pelo nav da Home). */
export default function MesasPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const tables = useMesas();
  const [refreshing, setRefreshing] = useState(false);
  const userID = session.status === 'signedIn' ? session.session.userID : null;

  // Recarrega ao voltar para a tela (ex.: depois de criar ou entrar numa mesa) se os dados já passaram do prazo.
  useRefetchOnFocus(mesaKeys.list);

  async function refresh() {
    setRefreshing(true);
    await tables.refresh();
    setRefreshing(false);
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <Header action={{ kind: 'back', onPress: back }} title="Mesas" titleStyle="heading" />

      {tables.status !== 'ready' && (
        <LoadState fill status={tables.status} onRetry={tables.retry} loadingText="" errorText="Não deu para carregar. Confira sua conexão." />
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
            <ListCard
              title={item.name}
              subtitle={`${item.gmID === userID ? 'Você é o mestre' : 'Você é jogador'} · D&D ${item.edition}`}
              icon={item.gmID === userID ? 'crown-outline' : 'castle'}
              tone={item.gmID === userID ? 'gold' : 'default'}
              accessibilityLabel={`Abrir mesa ${item.name}`}
              onPress={() => router.push(`/mesa/${item.id}`)}
            />
          )}
        />
      )}

      <FooterBar>
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
      </FooterBar>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  centered: { textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
});
