import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Character } from '@dnf/core/character';
import { DnfLogo, radius, spacing, useRpgTheme, type RpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../hooks/hook.session';

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; characters: Character.Info[] };

const EDITION_LABEL: Record<Character.Info['edition'], string> = { '2014': 'D&D 2014', '2024': 'D&D 2024' };

export default function Home() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCharacters = useCallback(async () => {
    try {
      const page = await Character.list({ pageSize: 100 });
      setLoad({ status: 'ready', characters: page.data });
    } catch {
      setLoad((current) => (current.status === 'ready' ? current : { status: 'error' }));
    }
  }, []);

  // Recarrega ao voltar para a tela (ex.: depois de criar um personagem).
  useFocusEffect(
    useCallback(() => {
      void fetchCharacters();
    }, [fetchCharacters]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchCharacters();
    setRefreshing(false);
  }

  const createCharacter = () => router.push('/character/new');
  const firstName = session.status === 'signedIn' ? session.session.user?.name?.split(' ')[0] : undefined;
  const characters = load.status === 'ready' ? load.characters : [];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <DnfLogo size={40} showName={false} animated={false} />
        <View style={styles.greeting}>
          <Text style={[styles.hello, { color: theme.textMuted }]}>Bem-vindo de volta</Text>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
            {firstName ?? 'Aventureiro'}
          </Text>
        </View>
        <Pressable onPress={session.logout} accessibilityRole="button" hitSlop={8} style={styles.logout}>
          <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Sair</Text>
        </Pressable>
      </View>

      {load.status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}

      {load.status === 'error' && (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Não deu para carregar</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Confira sua conexão e tente de novo.</Text>
          <Button theme={theme} label="Tentar de novo" variant="secondary" onPress={fetchCharacters} />
        </View>
      )}

      {load.status === 'ready' && characters.length === 0 && (
        <View style={styles.center}>
          <DnfLogo size={110} showName={false} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum personagem ainda</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Crie seu primeiro herói e comece a aventura.
          </Text>
          <Button theme={theme} label="Criar personagem" onPress={createCharacter} />
        </View>
      )}

      {load.status === 'ready' && characters.length > 0 && (
        <>
          <FlatList
            data={characters}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
            ListHeaderComponent={
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                Seus personagens · {characters.length}
              </Text>
            }
            renderItem={({ item }) => <CharacterCard theme={theme} character={item} />}
          />
          <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
            <Button theme={theme} label="Criar personagem" onPress={createCharacter} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function CharacterCard({ theme, character }: { theme: RpgTheme; character: Character.Info }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        <Text style={[styles.avatarText, { color: theme.accentText }]}>{character.name[0]?.toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
          {character.name}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
          Nível {character.level} · {EDITION_LABEL[character.edition]}
        </Text>
      </View>
    </View>
  );
}

interface ButtonProps {
  theme: RpgTheme;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

function Button({ theme, label, onPress, variant = 'primary' }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceRaised },
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? theme.accentText : theme.text }]}>
        {primary ? `+  ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  greeting: { flex: 1 },
  hello: { fontSize: 13 },
  userName: { fontSize: 20, fontWeight: '700' },
  logout: { padding: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontSize: 17, fontWeight: '700' },
  cardMeta: { fontSize: 13 },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  button: {
    alignSelf: 'stretch',
    minWidth: 220,
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
