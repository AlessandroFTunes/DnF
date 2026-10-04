import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Character } from '@dnf/core/character';
import { Mesa } from '@dnf/core/mesa';
import { Button, DnfLogo, DnfSpinner, radius, type RpgTheme, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { classIcon } from '../features/character-create/labels';
import { useSession } from '../hooks/hook.session';
import { srd, tr, useSrd } from '../lib/srd';

type Tab = 'characters' | 'tables';
type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T[] };

export default function Home() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState<Tab>('characters');
  const [characters, setCharacters] = useState<Load<Character.Info>>({ status: 'loading' });
  const [tables, setTables] = useState<Load<Mesa.Info>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const keep = <T,>(current: Load<T>): Load<T> => (current.status === 'ready' ? current : { status: 'error' });
    await Promise.all([
      Character.list({ pageSize: 100 }).then(
        (page) => setCharacters({ status: 'ready', data: page.data }),
        () => setCharacters(keep),
      ),
      Mesa.list({ pageSize: 100 }).then(
        (page) => setTables({ status: 'ready', data: page.data }),
        () => setTables(keep),
      ),
    ]);
  }, []);

  // Recarrega ao voltar para a tela (ex.: depois de criar um personagem ou entrar numa mesa).
  useFocusEffect(
    useCallback(() => {
      void fetchAll();
    }, [fetchAll]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }

  const userID = session.status === 'signedIn' ? session.session.userID : null;
  const firstName = session.status === 'signedIn' ? session.session.user?.name?.split(' ')[0] : undefined;
  const load = tab === 'characters' ? characters : tables;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <DnfLogo size={40} showName={false} animated={false} />
        <View style={styles.greeting}>
          <Text style={[typography.caption, { color: theme.textMuted }]}>Bem-vindo de volta</Text>
          <Text style={[typography.heading, { color: theme.text }]} numberOfLines={1}>
            {firstName ?? 'Aventureiro'}
          </Text>
        </View>
        <Pressable onPress={session.logout} accessibilityRole="button" hitSlop={8} style={styles.logout}>
          <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Sair</Text>
        </Pressable>
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]} accessibilityRole="tablist">
        {(
          [
            { id: 'characters', label: 'Personagens', icon: 'account-group-outline' },
            { id: 'tables', label: 'Mesas', icon: 'castle' },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected && [{ backgroundColor: theme.surfaceRaised }, shadow(theme, 1)]]}
            >
              <MaterialCommunityIcons name={t.icon} size={18} color={selected ? theme.accent : theme.textMuted} />
              <Text style={[typography.bodyStrong, { color: selected ? theme.accent : theme.textMuted }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {load.status === 'loading' && (
        <View style={styles.center}>
          <DnfSpinner size={56} />
        </View>
      )}

      {load.status === 'error' && (
        <View style={styles.center}>
          <Text style={[typography.heading, styles.centered, { color: theme.text }]}>Não deu para carregar</Text>
          <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>Confira sua conexão e tente de novo.</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={fetchAll} />
        </View>
      )}

      {tab === 'characters' && characters.status === 'ready' && (
        <>
          <FlatList
            data={characters.data}
            keyExtractor={(c) => c.id}
            contentContainerStyle={[styles.list, characters.data.length === 0 && styles.flexGrow]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
            ListHeaderComponent={
              characters.data.length ? (
                <Text style={[typography.overline, { color: theme.textMuted }]}>Seus personagens · {characters.data.length}</Text>
              ) : null
            }
            ListEmptyComponent={
              <Empty
                logo
                title="Nenhum personagem ainda"
                text="Crie seu primeiro herói e comece a aventura."
              />
            }
            renderItem={({ item }) => (
              <CharacterCard theme={theme} character={item} onPress={() => router.push(`/character/${item.id}`)} />
            )}
          />
          <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
            <Button
              label="Criar personagem"
              onPress={() => router.push('/character/new')}
              icon={(color) => <MaterialCommunityIcons name="plus" size={20} color={color} />}
            />
          </View>
        </>
      )}

      {tab === 'tables' && tables.status === 'ready' && (
        <>
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
              <Empty
                icon="castle"
                title="Nenhuma mesa ainda"
                text="Peça o código ao mestre para entrar, ou crie uma mesa e chame seus amigos."
              />
            }
            renderItem={({ item }) => (
              <MesaCard theme={theme} mesa={item} isGM={item.gmID === userID} onPress={() => router.push(`/mesa/${item.id}`)} />
            )}
          />
          <View style={[styles.footer, styles.footerRow, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
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
        </>
      )}
    </SafeAreaView>
  );
}

function Empty({ title, text, logo, icon }: { title: string; text: string; logo?: boolean; icon?: 'castle' }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.center}>
      {logo ? <DnfLogo size={110} showName={false} /> : <MaterialCommunityIcons name={icon ?? 'castle'} size={64} color={theme.gold} />}
      <Text style={[typography.heading, styles.centered, { color: theme.text }]}>{title}</Text>
      <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

function CharacterCard({ theme, character, onPress }: { theme: RpgTheme; character: Character.Info; onPress: () => void }) {
  const { edition } = character;
  const classKey = character.classes[0]?.classKey;
  // Nome da classe vem da Open5e (em cache; enquanto carrega, mostra só nível e edição).
  const classes = useSrd(`classes:${edition}`, () => srd.classes(edition));
  const found = classes.status === 'ready' ? classes.data.find((c) => c.key === classKey) : undefined;
  const className = found ? tr.name(found) : undefined;
  const { hpCurrent, hpMax } = character.combat;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ficha de ${character.name}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        shadow(theme, 1),
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        <MaterialCommunityIcons name={classKey ? classIcon(classKey) : 'dice-d20'} size={24} color={theme.accentText} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[typography.subheading, { color: theme.text }]} numberOfLines={1}>
          {character.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
          {[className, `Nível ${character.level}`, hpMax ? `PV ${hpCurrent}/${hpMax}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={[styles.editionBadge, { borderColor: theme.gold, backgroundColor: theme.goldSoft }]}>
        <Text style={[styles.editionText, { color: theme.gold }]}>{edition}</Text>
      </View>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  greeting: { flex: 1 },
  logout: { padding: spacing.sm },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, padding: 3 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 8, borderRadius: radius.pill },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  editionBadge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  editionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  centered: { textAlign: 'center' },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
