import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Character } from '@dnf/core/character';
import { Button, D20, DnfLogo, DnfSpinner, fonts, mixColor, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { classIcon } from '../features/character-create/labels';
import { HeroArt } from '../features/home/HeroArt';
import { useSession } from '../hooks/hook.session';
import { srd, tr, useSrd } from '../lib/srd';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Character.Info[] };

/** Lado dos blocos de personagem; a curva do painel passa na metade da primeira fileira. */
const TILE = 104;
/** Altura da curva no topo do painel. */
const ARC = 32;

/** Cor de cada personagem (estável pelo id), como os perfis coloridos de um app de streaming. */
const TILE_COLORS = ['#C8191E', '#8F4BC9', '#3FA3B8', '#E8822E', '#4B7BE5', '#2F8F5B', '#C2477E', '#B8860B'];

function tileColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length] ?? TILE_COLORS[0]!;
}

/** Início: nav para as mesas em cima, a arte do grupo no meio e os personagens embaixo. */
export default function Home() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [characters, setCharacters] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCharacters = useCallback(async () => {
    await Character.list({ pageSize: 100 }).then(
      (page) => setCharacters({ status: 'ready', data: page.data }),
      () => setCharacters((current) => (current.status === 'ready' ? current : { status: 'error' })),
    );
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

  const firstName = session.status === 'signedIn' ? session.session.user?.name?.split(' ')[0] : undefined;
  // A arte ocupa mais da metade da tela, como o pôster de um app de streaming; na web não passa de 600 px.
  const heroHeight = Math.min(Math.max(height * 0.56, 320), 600);
  const panelColor = mixColor(theme.surfaceRaised, theme.borderStrong, 0.18);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
      >
        <HeroArt height={heroHeight} />

        <View style={styles.heading}>
          <Text style={[typography.caption, { color: theme.textMuted }]}>Bem-vindo de volta, {firstName ?? 'aventureiro'}</Text>
          <Text style={[typography.heading, { color: theme.text }]}>Escolha seu personagem</Text>
        </View>

        <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.xl }]}>
          {/* Fundo do painel com a curva em cima, passando atrás da primeira fileira; some no fundo lá embaixo. */}
          <Svg style={[styles.panelFill, { top: TILE / 2 }]} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id="home-panel" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={panelColor} />
                <Stop offset="0.7" stopColor={theme.surface} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#home-panel)" />
          </Svg>
          <Svg
            style={[styles.arc, { top: TILE / 2 - ARC }]}
            width="100%"
            height={ARC + 1}
            viewBox={`0 0 100 ${ARC + 1}`}
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Path d={`M0 ${ARC + 1} L0 ${ARC} Q50 ${-ARC} 100 ${ARC} L100 ${ARC + 1} Z`} fill={panelColor} />
            <Path
              d={`M0 ${ARC} Q50 ${-ARC} 100 ${ARC}`}
              fill="none"
              stroke={theme.borderStrong}
              strokeOpacity={0.7}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </Svg>

          {characters.status === 'loading' && (
            <View style={styles.state}>
              <DnfSpinner size={56} />
            </View>
          )}

          {characters.status === 'error' && (
            <View style={[styles.state, styles.stateBelowArc]}>
              <Text style={[typography.heading, styles.centered, { color: theme.text }]}>Não deu para carregar</Text>
              <Text style={[typography.body, styles.centered, { color: theme.textMuted }]}>Confira sua conexão e tente de novo.</Text>
              <Button label="Tentar de novo" variant="secondary" onPress={fetchCharacters} />
            </View>
          )}

          {characters.status === 'ready' && (
            <>
              <View style={styles.grid}>
                {characters.data.map((c) => (
                  <CharacterTile key={c.id} character={c} onPress={() => router.push(`/character/${c.id}`)} />
                ))}
                <NewTile onPress={() => router.push('/character/new')} />
              </View>
              {characters.data.length === 0 && (
                <Text style={[typography.body, styles.centered, styles.hint, { color: theme.textMuted }]}>
                  Crie seu primeiro herói e comece a aventura.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Nav por cima da arte. */}
      <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <DnfLogo size={84} animated={false} />
        <View style={styles.navActions}>
          <Pressable
            onPress={() => router.push('/mesa')}
            accessibilityRole="button"
            accessibilityLabel="Mesas"
            style={({ pressed }) => [styles.navPill, { borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialCommunityIcons name="castle" size={18} color={theme.gold} />
            <Text style={[typography.bodyStrong, { color: theme.text }]}>Mesas</Text>
          </Pressable>
          <Pressable
            onPress={session.logout}
            accessibilityRole="button"
            accessibilityLabel="Sair"
            hitSlop={8}
            style={({ pressed }) => [styles.navIcon, { borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialCommunityIcons name="logout" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CharacterTile({ character, onPress }: { character: Character.Info; onPress: () => void }) {
  const theme = useRpgTheme();
  const { edition } = character;
  const classKey = character.classes[0]?.classKey;
  // Nome da classe vem da 5e-FastAPI (em cache; enquanto carrega, mostra só o nível).
  const classes = useSrd(`classes:${edition}`, () => srd.classes(edition));
  const found = classes.status === 'ready' ? classes.data.find((c) => c.key === classKey) : undefined;
  const className = found ? tr.name(found) : undefined;
  const color = tileColor(character.id);
  const gradientId = `tile-${character.id}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ficha de ${character.name}${className ? `, ${className}` : ''}, nível ${character.level}`}
      style={({ pressed }) => [styles.tileSlot, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.tile, { boxShadow: `0px 8px 22px ${color}40` }]}>
        <View style={[styles.tileFace, { borderColor: mixColor(color, '#FFFFFF', 0.35) }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={mixColor(color, '#FFFFFF', 0.18)} />
                <Stop offset="1" stopColor={mixColor(color, '#000000', 0.45)} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
          {/* Enquanto a classe carrega (ou se não achar), mostra o d20 com o nível. */}
          {className ? (
            <MaterialCommunityIcons name={classIcon(className)} size={50} color="#FFFFFF" />
          ) : (
            <D20 size={60} value={character.level} color={mixColor(color, '#FFFFFF', 0.1)} numberColor="#FFFFFF" />
          )}
          <Text style={styles.edition}>{edition}</Text>
        </View>
        <View style={[styles.level, { backgroundColor: theme.surface, borderColor: theme.gold }]}>
          <Text style={[styles.levelLabel, { color: theme.textMuted }]}>NV</Text>
          <Text style={[styles.levelText, { color: theme.text }]}>{character.level}</Text>
        </View>
      </View>
      <Text style={[typography.bodyStrong, styles.centered, { color: theme.text }]} numberOfLines={1}>
        {character.name}
      </Text>
      {className ? (
        <Text style={[typography.caption, styles.centered, styles.tileCaption, { color: theme.textMuted }]} numberOfLines={1}>
          {className}
        </Text>
      ) : null}
    </Pressable>
  );
}

function NewTile({ onPress }: { onPress: () => void }) {
  const theme = useRpgTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Criar personagem"
      style={({ pressed }) => [styles.tileSlot, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.tile, styles.tileFace, styles.newTile, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
        <View style={[styles.plus, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          <MaterialCommunityIcons name="plus" size={28} color={theme.accent} />
        </View>
      </View>
      <Text style={[typography.bodyStrong, styles.centered, { color: theme.textMuted }]}>Novo herói</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  heading: { alignItems: 'center', gap: 2, marginTop: -spacing.xxl, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  panel: { flexGrow: 1, paddingHorizontal: spacing.lg },
  panelFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  arc: { position: 'absolute', left: 0, right: 0 },
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateBelowArc: { marginTop: TILE / 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.xl,
    rowGap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tileSlot: { width: TILE + spacing.md, alignItems: 'center', gap: spacing.xs },
  tile: { width: TILE, height: TILE, borderRadius: radius.lg, marginBottom: spacing.sm },
  tileFace: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTile: { flex: 0 },
  plus: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Selo do nível: pílula dourada no pé do bloco, metade para fora.
  level: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  levelLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  levelText: { fontFamily: fonts.displayHeavy, fontSize: 14 },
  edition: {
    position: 'absolute',
    top: 6,
    left: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tileCaption: { marginTop: -spacing.xs },
  hint: { marginTop: spacing.lg },
  centered: { textAlign: 'center' },
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 7, 7, 0.6)',
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 7, 7, 0.6)',
  },
});
