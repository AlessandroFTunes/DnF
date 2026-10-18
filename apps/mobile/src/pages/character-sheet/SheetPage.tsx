import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Character } from '@dnf/core/character';
import {
  Button,
  Chip,
  defaultTheme,
  DnfSpinner,
  fonts,
  legendaryTheme,
  mixTheme,
  radius,
  RpgThemeOverride,
  shadow,
  spacing,
  typography,
  useRpgTheme,
} from '@dnf/ui-react-native';
import { classIcon, type IconName } from '../../features/character-create/labels';
import { Features, Story } from '../../features/character-sheet/sections/Features';
import { Attacks, Inventory } from '../../features/character-sheet/sections/Inventory';
import { Abilities, StatusPanel } from '../../features/character-sheet/sections/Overview';
import { Progression } from '../../features/character-sheet/sections/Progression';
import { Skills } from '../../features/character-sheet/sections/Skills';
import { Spells } from '../../features/character-sheet/sections/Spells';
import { Tables } from '../../features/character-sheet/sections/Tables';
import { ThemeHold, useBlend } from '../../features/character-sheet/themeBlend';
import { useSheet, type Sheet } from '../../features/character-sheet/useSheet';
import { tr } from '../../lib/srd';

type TabId = 'sheet' | 'progression' | 'story' | 'tables';

/** Abas do topo: a ficha de jogo, a árvore de evolução, a história e as mesas. */
const TABS: { id: TabId; label: string }[] = [
  { id: 'sheet', label: 'Ficha' },
  { id: 'progression', label: 'Árvore' },
  { id: 'story', label: 'História' },
  { id: 'tables', label: 'Mesas' },
];

type DetailId = 'combat' | 'spells' | 'skills' | 'features' | 'inventory';

/** Filtros da parte de baixo da ficha (abaixo do status e dos atributos). */
const DETAILS: { id: DetailId; label: string; icon: IconName }[] = [
  { id: 'combat', label: 'Combate', icon: 'sword-cross' },
  { id: 'spells', label: 'Magias', icon: 'auto-fix' },
  { id: 'skills', label: 'Perícias', icon: 'star-four-points-outline' },
  { id: 'features', label: 'Habilidades', icon: 'medal-outline' },
  { id: 'inventory', label: 'Inventário', icon: 'bag-personal-outline' },
];

/** Largura máxima do conteúdo em telas largas. */
const CONTENT_WIDTH = 760;

/** Nível em que o personagem vira herói lendário: a ficha inteira fica preta e amarela. */
const LEGENDARY_LEVEL = 20;

export default function SheetPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sheet = useSheet(id);
  const legendary = (sheet.character?.level ?? 0) >= LEGENDARY_LEVEL;
  // Remonta ao carregar: quem abre a ficha de um herói já lendário vê o tema dourado direto, sem transição.
  return (
    <LegendaryTheme key={sheet.character ? 'loaded' : 'loading'} legendary={legendary}>
      <SheetScreen sheet={sheet} />
    </LegendaryTheme>
  );
}

/** Tema da ficha: passa suavemente do vermelho para o amarelo quando o personagem vira lendário. */
function LegendaryTheme({ legendary, children }: { legendary: boolean; children: ReactNode }) {
  const [held, setHeld] = useState(false);
  const blend = useBlend(legendary ? 1 : 0, held);
  return (
    <ThemeHold.Provider value={setHeld}>
      <RpgThemeOverride.Provider value={mixTheme(defaultTheme, legendaryTheme, blend)}>{children}</RpgThemeOverride.Provider>
    </ThemeHold.Provider>
  );
}

/**
 * Ficha do personagem: cabeçalho com nome, abas no topo (Ficha, Árvore, História, Mesas) e, na aba Ficha,
 * o status (PV, CA, dados de vida…) e os atributos em cima, com chips que filtram o resto embaixo.
 */
function SheetScreen({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('sheet');
  const [detail, setDetail] = useState<DetailId>('combat');
  const scroll = useRef<ScrollView>(null);
  // Posição dos chips: trocar de filtro rola até eles, em vez de deixar o jogador no meio da lista anterior.
  const chipsY = useRef(0);
  const scrollY = useRef(0);

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const selectTab = (next: TabId) => {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const selectDetail = (next: DetailId) => {
    setDetail(next);
    if (scrollY.current > chipsY.current) scroll.current?.scrollTo({ y: chipsY.current, animated: false });
  };

  if (sheet.status !== 'ready' || !sheet.character) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.surface }]}>
        {sheet.status === 'loading' ? (
          <DnfSpinner size={56} />
        ) : (
          <>
            <Text style={[typography.heading, { color: theme.text }]}>
              {sheet.status === 'missing' ? 'Personagem não encontrado' : 'Não deu para abrir a ficha'}
            </Text>
            <Button label="Voltar" variant="secondary" onPress={exit} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const { derived } = sheet;
  const casts = !!derived && (!!derived.castAbility || derived.spells.length > 0 || derived.spellsLoading);
  const details = DETAILS.filter((d) => d.id !== 'spells' || casts);
  const shownDetail = details.some((d) => d.id === detail) ? detail : 'combat';

  const loading = (
    <View style={styles.loading}>
      {sheet.srdFailed ? (
        <>
          <Text style={[typography.bodyStrong, { color: theme.text }]}>Não deu para falar com a API de regras</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={sheet.retrySrd} />
        </>
      ) : (
        <>
          <DnfSpinner size={44} />
          <Text style={[typography.caption, { color: theme.textMuted }]}>Consultando o compêndio…</Text>
        </>
      )}
    </View>
  );

  const sheetTab = derived && tab === 'sheet';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <Header sheet={sheet} onExit={exit} onDeleted={() => router.replace('/')} />

      <View style={[styles.tabs, { borderBottomColor: theme.border }]} accessibilityRole="tablist">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => selectTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, { color: selected ? theme.text : theme.textMuted }]}>{t.label}</Text>
              <View style={[styles.tabLine, { backgroundColor: selected ? theme.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.content}
        // Na aba Ficha, os chips (terceiro filho) grudam no topo ao rolar.
        stickyHeaderIndices={sheetTab ? [2] : undefined}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
      >
        {!derived ? (
          loading
        ) : tab === 'sheet' ? (
          [
            <View key="status" style={styles.block}>
              <StatusPanel sheet={sheet} />
            </View>,
            <View key="abilities" style={styles.block}>
              <Abilities sheet={sheet} />
            </View>,
            <View
              key="chips"
              onLayout={(e) => (chipsY.current = e.nativeEvent.layout.y)}
              style={[styles.chipsBar, { backgroundColor: theme.surface }]}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {details.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.label}
                    selected={d.id === shownDetail}
                    onPress={() => selectDetail(d.id)}
                    icon={(c) => <MaterialCommunityIcons name={d.icon} size={16} color={c} />}
                  />
                ))}
              </ScrollView>
            </View>,
            <View key="detail" style={styles.block}>
              {shownDetail === 'combat' && <Attacks sheet={sheet} />}
              {shownDetail === 'spells' && <Spells sheet={sheet} />}
              {shownDetail === 'skills' && <Skills data={derived} />}
              {shownDetail === 'features' && <Features data={derived} />}
              {shownDetail === 'inventory' && <Inventory sheet={sheet} />}
            </View>,
          ]
        ) : (
          <View style={styles.block}>
            {tab === 'progression' && <Progression sheet={sheet} />}
            {tab === 'story' && <Story sheet={sheet} />}
            {tab === 'tables' && <Tables sheet={sheet} />}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Topo: voltar, nome com classe e nível, e o menu com a exclusão do personagem. */
function Header({ sheet, onExit, onDeleted }: { sheet: Sheet; onExit: () => void; onDeleted: () => void }) {
  const theme = useRpgTheme();
  const { character, derived } = sheet;
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>('idle');

  // O pedido de confirmação some sozinho se o jogador não tocar de novo.
  useEffect(() => {
    if (deleteState !== 'confirming') return;
    const timer = setTimeout(() => setDeleteState('idle'), 4000);
    return () => clearTimeout(timer);
  }, [deleteState]);

  if (!character) return null;

  /** Exclusão pede um segundo toque (Alert não existe na web). */
  const remove = async () => {
    if (deleteState !== 'confirming') {
      setDeleteState('confirming');
      return;
    }
    setDeleteState('deleting');
    try {
      await Character.remove(character.id);
      onDeleted();
    } catch {
      setDeleteState('error');
    }
  };

  const species = derived?.chain.at(-1);
  // Multiclasse: "Guerreiro 3 / Mago 2".
  const classNames =
    derived && (derived.classes.length > 1 ? derived.classes.map((c) => `${tr.name(c.cls)} ${c.level}`).join(' / ') : tr.name(derived.cls));
  const subtitle = [species && tr.name(species), classNames, `nível ${character.level}`, `D&D ${character.edition}`]
    .filter(Boolean)
    .join(' · ');
  const legendary = character.level >= LEGENDARY_LEVEL;

  return (
    <View style={styles.header}>
      <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} style={styles.headerButton}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={[styles.medallion, { backgroundColor: legendary ? theme.gold : theme.accent }, shadow(theme, 1)]}>
        <MaterialCommunityIcons
          name={legendary ? 'crown' : classIcon(derived?.cls.name ?? '')}
          size={20}
          color={theme.accentText}
        />
      </View>

      <View style={styles.flex}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {character.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {!sheet.isOwner && (
          <Text style={[typography.caption, { color: theme.gold }]}>Somente leitura (visão do mestre)</Text>
        )}
      </View>

      {sheet.isOwner && (
        <Pressable
          onPress={() => {
            setMenuOpen(!menuOpen);
            setDeleteState('idle');
          }}
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
          accessibilityState={{ expanded: menuOpen }}
          hitSlop={8}
          style={styles.headerButton}
        >
          <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
        </Pressable>
      )}

      {menuOpen && (
        <View style={[styles.menu, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, shadow(theme, 2)]}>
          <Pressable
            onPress={() => void remove()}
            disabled={deleteState === 'deleting'}
            accessibilityRole="button"
            accessibilityLabel={deleteState === 'confirming' ? 'Confirmar exclusão do personagem' : 'Excluir personagem'}
            style={({ pressed }) => [
              styles.menuItem,
              { backgroundColor: deleteState === 'confirming' ? theme.negative : pressed ? theme.surface : 'transparent' },
            ]}
          >
            <MaterialCommunityIcons
              name={deleteState === 'confirming' ? 'alert-outline' : 'trash-can-outline'}
              size={18}
              color={deleteState === 'confirming' ? theme.accentText : theme.negative}
            />
            <Text
              style={[
                typography.caption,
                { color: deleteState === 'confirming' ? theme.accentText : theme.negative, fontWeight: '700' },
              ]}
            >
              {deleteState === 'confirming'
                ? 'Toque de novo para excluir'
                : deleteState === 'deleting'
                  ? 'Excluindo…'
                  : 'Excluir personagem'}
            </Text>
          </Pressable>
          {deleteState === 'error' && (
            <Text style={[typography.caption, styles.menuError, { color: theme.negative }]}>Não deu para excluir. Tente de novo.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
    maxWidth: CONTENT_WIDTH,
    alignSelf: 'center',
    zIndex: 10,
    elevation: 10,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  medallion: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 20 },
  menu: {
    position: 'absolute',
    top: 52,
    right: spacing.md,
    minWidth: 220,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  menuError: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: CONTENT_WIDTH,
    alignSelf: 'center',
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  tabLabel: { fontSize: 15, fontWeight: '700', paddingBottom: spacing.sm },
  tabLine: { height: 3, width: 32, borderRadius: radius.pill },
  content: { paddingBottom: spacing.xxl, width: '100%', maxWidth: CONTENT_WIDTH, alignSelf: 'center' },
  block: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  chipsBar: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
});
