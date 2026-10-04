import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, DnfSpinner, duration, fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { classIcon, type IconName } from '../../features/character-create/labels';
import { Features, Story } from '../../features/character-sheet/sections/Features';
import { Inventory } from '../../features/character-sheet/sections/Inventory';
import { Overview, VitalsPanel } from '../../features/character-sheet/sections/Overview';
import { Progression } from '../../features/character-sheet/sections/Progression';
import { Skills } from '../../features/character-sheet/sections/Skills';
import { Spells } from '../../features/character-sheet/sections/Spells';
import { Tables } from '../../features/character-sheet/sections/Tables';
import { useSheet, type Sheet } from '../../features/character-sheet/useSheet';
import { tr } from '../../lib/srd';

type SectionId = 'overview' | 'skills' | 'inventory' | 'spells' | 'features' | 'progression' | 'story' | 'tables';

const SECTIONS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Visão geral', icon: 'card-account-details-outline' },
  { id: 'skills', label: 'Perícias', icon: 'star-four-points-outline' },
  { id: 'inventory', label: 'Inventário e ataques', icon: 'bag-personal-outline' },
  { id: 'spells', label: 'Magias', icon: 'auto-fix' },
  { id: 'features', label: 'Habilidades', icon: 'sword-cross' },
  { id: 'progression', label: 'Árvore de evolução', icon: 'graph-outline' },
  { id: 'story', label: 'História', icon: 'feather' },
  { id: 'tables', label: 'Mesas', icon: 'castle' },
];

const SIDEBAR_WIDTH = 264;

/** Ficha do personagem: barra lateral de seções, conteúdo e (em telas largas) PV fixo à direita. */
export default function SheetPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sheet = useSheet(id);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const veryWide = width >= 1250;
  const [section, setSection] = useState<SectionId>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const select = (next: SectionId) => {
    setSection(next);
    setDrawerOpen(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
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
            <Button label="Voltar" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const sidebar = <Sidebar sheet={sheet} active={section} onSelect={select} onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      {!wide && (
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir seções da ficha"
            hitSlop={8}
            style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          >
            <MaterialCommunityIcons name="menu" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={[typography.heading, { color: theme.text }]} numberOfLines={1}>
              {sheet.character.name}
            </Text>
            <Text style={[typography.caption, { color: theme.textMuted }]}>{SECTIONS.find((s) => s.id === section)?.label}</Text>
          </View>
          <View style={[styles.hpChip, { borderColor: theme.negative }]}>
            <MaterialCommunityIcons name="heart" size={14} color={theme.negative} />
            <Text style={[typography.caption, { color: theme.text, fontWeight: '800' }]}>
              {sheet.character.combat.hpCurrent}/{sheet.character.combat.hpMax}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.body}>
        {wide && <View style={[styles.sidebar, { borderRightColor: theme.border, backgroundColor: theme.surfaceSunken }]}>{sidebar}</View>}

        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={[styles.content, wide && styles.contentWide]}>
          {!sheet.derived ? (
            <View style={styles.loading}>
              {sheet.srdFailed ? (
                <>
                  <Text style={[typography.bodyStrong, { color: theme.text }]}>Não deu para falar com a Open5e</Text>
                  <Button label="Tentar de novo" variant="secondary" onPress={sheet.retrySrd} />
                </>
              ) : (
                <>
                  <DnfSpinner size={44} />
                  <Text style={[typography.caption, { color: theme.textMuted }]}>Consultando o compêndio…</Text>
                </>
              )}
            </View>
          ) : (
            <>
              {section === 'overview' && <Overview sheet={sheet} showVitals={!veryWide} />}
              {section === 'skills' && <Skills data={sheet.derived} />}
              {section === 'inventory' && <Inventory sheet={sheet} />}
              {section === 'spells' && <Spells sheet={sheet} />}
              {section === 'features' && <Features data={sheet.derived} />}
              {section === 'progression' && <Progression sheet={sheet} />}
              {section === 'story' && <Story sheet={sheet} />}
              {section === 'tables' && <Tables sheet={sheet} />}
            </>
          )}
        </ScrollView>

        {veryWide && sheet.derived && (
          <View style={[styles.rightBar, { borderLeftColor: theme.border, backgroundColor: theme.surfaceSunken }]}>
            <ScrollView contentContainerStyle={styles.rightContent}>
              <VitalsPanel sheet={sheet} />
            </ScrollView>
          </View>
        )}
      </View>

      {!wide && <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>{sidebar}</Drawer>}
    </SafeAreaView>
  );
}

function Sidebar({
  sheet,
  active,
  onSelect,
  onExit,
}: {
  sheet: Sheet;
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onExit: () => void;
}) {
  const theme = useRpgTheme();
  const { character, derived } = sheet;
  if (!character) return null;
  const species = derived?.chain.at(-1);
  const subtitle = [species && tr.name(species), derived && tr.name(derived.cls), `nível ${character.level}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.sidebarContent}>
      <View style={styles.identity}>
        <View style={[styles.medallion, { backgroundColor: theme.accent }, shadow(theme, 2)]}>
          <MaterialCommunityIcons name={classIcon(character.classes[0]?.classKey ?? '')} size={34} color={theme.accentText} />
        </View>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {character.name}
        </Text>
        <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>{subtitle}</Text>
        <View style={[styles.edition, { borderColor: theme.gold, backgroundColor: theme.goldSoft }]}>
          <Text style={[styles.editionText, { color: theme.gold }]}>D&D {character.edition}</Text>
        </View>
        {!sheet.isOwner && (
          <Text style={[typography.caption, { color: theme.gold }]}>Somente leitura (visão do mestre)</Text>
        )}
      </View>

      <View style={styles.nav}>
        {SECTIONS.map((s) => {
          const selected = s.id === active;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.navItem,
                {
                  backgroundColor: selected ? theme.accentSoft : pressed ? theme.surface : 'transparent',
                  borderColor: selected ? theme.accent : 'transparent',
                },
              ]}
            >
              <MaterialCommunityIcons name={s.icon} size={20} color={selected ? theme.accent : theme.textMuted} />
              <Text style={[typography.bodyStrong, { color: selected ? theme.accent : theme.text }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onExit} accessibilityRole="button" style={styles.exit}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={theme.textMuted} />
        <Text style={[typography.caption, { color: theme.textMuted, fontWeight: '700' }]}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Gaveta lateral do celular. */
function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useRpgTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: duration.base, useNativeDriver: false }).start();
  }, [open, progress]);

  // Sempre montada (fora da tela quando fechada); só recebe toques quando aberta.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar seções" />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: theme.surfaceSunken, borderRightColor: theme.border },
          { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-SIDEBAR_WIDTH - 20, 0] }) }] },
        ]}
      >
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          {children}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: SIDEBAR_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarContent: { padding: spacing.lg, gap: spacing.xl, flexGrow: 1 },
  identity: { alignItems: 'center', gap: spacing.xs },
  medallion: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  name: { fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  edition: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 2, marginTop: spacing.xs },
  editionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  nav: { gap: spacing.xxs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  exit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 'auto', padding: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  contentWide: { padding: spacing.xl, maxWidth: 860, width: '100%', alignSelf: 'center' },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  rightBar: { width: 320, borderLeftWidth: StyleSheet.hairlineWidth },
  rightContent: { padding: spacing.lg, gap: spacing.lg },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
});
