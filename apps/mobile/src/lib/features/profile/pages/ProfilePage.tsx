import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Mesa } from '@dnf/core/mesa';
import { User } from '@dnf/core/user';
import { Button, fonts, mixColor, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Avatar, SectionLabel } from '../../../components';
import { useSession } from '../../auth/functions/hook.session';
import { useCharacters } from '../../character-sheet/functions/queries';
import { tileColor } from '../../home/functions/tile-color';
import { mesaCover } from '../../mesa/functions/cover';
import { useMesas } from '../../mesa/functions/queries';
import { usePreferences, useProfile, useUpdateProfile } from '../functions/queries';

type TabId = 'mesas' | 'personagens' | 'ajustes';
const TABS: { id: TabId; label: string }[] = [
  { id: 'mesas', label: 'Mesas' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'ajustes', label: 'Ajustes' },
];

/** Preferências que o jogador liga e desliga aqui (cada uma é um campo de `User.Preferences`). */
const PREFERENCES: { key: keyof User.Preferences; icon: 'microphone-outline' | 'music-note'; title: string; caption: string }[] = [
  { key: 'narration', icon: 'microphone-outline', title: 'Narração', caption: 'O narrador e o Grande Sábio falam em voz alta.' },
  { key: 'sounds', icon: 'music-note', title: 'Efeitos sonoros', caption: 'Sons e ambientação da subida de nível.' },
];

/**
 * Aba Perfil, no estilo do perfil do Xbox: faixa de capa, avatar com o lápis de edição, números do jogador e abas
 * (Personagens, Mesas e Ajustes) com o conteúdo logo abaixo.
 */
export default function ProfilePage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const { user, email } = useProfile();
  const characters = useCharacters();
  const mesas = useMesas();
  const [tab, setTab] = useState<TabId>('mesas');

  const name = user ? User.displayName(user) : 'Aventureiro';
  const count = (s: { status: string; data?: unknown[] }) => (s.status === 'ready' ? String(s.data?.length ?? 0) : '–');
  const highestLevel =
    characters.status === 'ready' && characters.data.length ? String(Math.max(...characters.data.map((c) => c.level))) : '–';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} stickyHeaderIndices={[2]}>
        {/* Capa: degradê do vermelho do tema até o fundo, com a engrenagem dos ajustes. */}
        <View style={styles.cover}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="profile-cover" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={mixColor(theme.accent, theme.surface, 0.35)} />
                <Stop offset="1" stopColor={theme.surface} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#profile-cover)" />
          </Svg>
          <Pressable
            onPress={() => setTab('ajustes')}
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
            hitSlop={8}
            style={[styles.gear, { backgroundColor: mixColor(theme.surface, '#000000', 0.4) }]}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <View style={styles.identityRow}>
            <Pressable onPress={() => router.push('/perfil/editar')} accessibilityRole="button" accessibilityLabel="Editar foto do perfil">
              <Avatar uri={user?.avatar ?? null} name={name} size={92} />
              <View style={[styles.pencil, { backgroundColor: theme.surfaceRaised, borderColor: theme.surface }]}>
                <MaterialCommunityIcons name="pencil" size={14} color={theme.text} />
              </View>
            </Pressable>
            <View style={styles.flex}>
              <Text style={[typography.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
                {name}
              </Text>
              {user?.nickname ? <Text style={[typography.caption, { color: theme.gold }]}>{user.name}</Text> : null}
              {email ? (
                <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.stats}>
            <Stat value={count(mesas)} label="Mesas" />
            <Stat value={count(characters)} label="Personagens" />
            <Stat value={highestLevel} label="Maior nível" />
          </View>

          <Button
            label="Editar perfil"
            variant="secondary"
            onPress={() => router.push('/perfil/editar')}
            icon={(c) => <MaterialCommunityIcons name="account-edit-outline" size={18} color={c} />}
          />
        </View>

        {/* Abas com o traço embaixo da ativa; ficam coladas no topo ao rolar. */}
        <View style={[styles.tabs, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              style={[styles.tab, tab === t.id && { borderBottomColor: theme.text }]}
            >
              <Text style={[typography.bodyStrong, { color: tab === t.id ? theme.text : theme.textMuted }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'mesas' && <MesasTab />}
          {tab === 'personagens' && <CharactersTab />}
          {tab === 'ajustes' && <SettingsTab />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

/** "Jogadas recentemente": as mesas mais recentes como blocos coloridos, e atalhos para entrar ou criar uma. */
function MesasTab() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const mesas = useMesas();
  const userID = session.status === 'signedIn' ? session.session.userID : null;
  const recent = mesas.status === 'ready' ? [...mesas.data].sort((a, b) => b.timeUpdated.localeCompare(a.timeUpdated)).slice(0, 8) : [];

  return (
    <>
      <Text style={[typography.heading, { color: theme.text }]}>Jogadas recentemente</Text>
      {mesas.status === 'ready' && recent.length === 0 && (
        <Text style={[typography.body, { color: theme.textMuted }]}>Nenhuma mesa ainda. Entre com o código do mestre ou crie a sua.</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        {recent.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => router.push(`/mesa/${m.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir a mesa ${m.name}, ${m.gmID === userID ? 'você é o mestre' : 'você é jogador'}`}
            style={({ pressed }) => [styles.tile, { backgroundColor: tileColor(m.id), opacity: pressed ? 0.85 : 1 }]}
          >
            <MesaTileCover mesa={m} />
            <MaterialCommunityIcons name={m.gmID === userID ? 'crown-outline' : 'castle'} size={30} color="#FFFFFF" />
            <View>
              <Text style={styles.tileName} numberOfLines={2}>
                {m.name}
              </Text>
              <Text style={styles.tileCaption}>D&D {m.edition}</Text>
            </View>
          </Pressable>
        ))}
        <NewTile icon="door-open" label="Entrar" onPress={() => router.push('/mesa/join')} />
        <NewTile icon="plus" label="Criar" onPress={() => router.push('/mesa/new')} />
      </ScrollView>
    </>
  );
}

/** Capa da mesa (do DM-Control) cobrindo o bloco, com uma sombra embaixo para o nome continuar legível. */
function MesaTileCover({ mesa }: { mesa: Mesa.Info }) {
  const [failed, setFailed] = useState(false);
  const source = mesaCover(mesa);
  if (!source || failed) return null;
  return (
    <>
      <Image source={source} onError={() => setFailed(true)} accessibilityIgnoresInvertColors style={styles.tileCover} />
      <View style={styles.tileShade} />
    </>
  );
}

/** Os personagens do jogador, com o nível em destaque. */
function CharactersTab() {
  const theme = useRpgTheme();
  const router = useRouter();
  const characters = useCharacters();
  const list = characters.status === 'ready' ? [...characters.data].sort((a, b) => b.timeUpdated.localeCompare(a.timeUpdated)) : [];

  return (
    <>
      <Text style={[typography.heading, { color: theme.text }]}>Seus personagens</Text>
      {characters.status === 'ready' && list.length === 0 && (
        <Text style={[typography.body, { color: theme.textMuted }]}>Nenhum personagem ainda. Crie seu primeiro herói.</Text>
      )}
      <View style={styles.grid}>
        {list.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/character/${c.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ficha de ${c.name}, nível ${c.level}`}
            style={({ pressed }) => [styles.tile, { backgroundColor: tileColor(c.id), opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.tileLevel}>{c.level}</Text>
            <Text style={styles.tileName} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
        <NewTile icon="plus" label="Novo" onPress={() => router.push('/character/new')} />
      </View>
    </>
  );
}

function NewTile({ icon, label, onPress }: { icon: 'plus' | 'door-open'; label: string; onPress: () => void }) {
  const theme = useRpgTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, styles.tileNew, { borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={32} color={theme.textMuted} />
      <Text style={[typography.caption, { color: theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function SettingsTab() {
  const theme = useRpgTheme();
  const session = useSession();
  return (
    <>
      <SectionLabel>Preferências</SectionLabel>
      <View style={[styles.prefs, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        {PREFERENCES.map((p, i) => (
          <PreferenceRow key={p.key} item={p} first={i === 0} />
        ))}
      </View>
      <Button
        label="Sair da conta"
        variant="ghost"
        onPress={session.logout}
        icon={(c) => <MaterialCommunityIcons name="logout" size={18} color={c} />}
      />
      <Text style={[typography.caption, styles.centered, { color: theme.textMuted }]}>DnF {Constants.expoConfig?.version ?? ''}</Text>
    </>
  );
}

function PreferenceRow({ item: row, first }: { item: (typeof PREFERENCES)[number]; first: boolean }) {
  const theme = useRpgTheme();
  const saved = usePreferences();
  const update = useUpdateProfile();
  // O interruptor muda no toque; se o servidor recusar, volta ao valor guardado.
  const [pending, setPending] = useState<boolean | null>(null);
  const value = pending ?? saved[row.key];

  async function toggle(next: boolean) {
    setPending(next);
    try {
      await update({ preferences: { [row.key]: next } });
    } catch {
      // volta ao valor guardado
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={[styles.prefRow, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <MaterialCommunityIcons name={row.icon} size={22} color={theme.gold} />
      <View style={styles.flex}>
        <Text style={[typography.bodyStrong, { color: theme.text }]}>{row.title}</Text>
        <Text style={[typography.caption, { color: theme.textMuted }]}>{row.caption}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(next) => void toggle(next)}
        accessibilityLabel={row.title}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor={theme.text}
      />
    </View>
  );
}

const TILE = 120;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  scroll: { paddingBottom: spacing.xxl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  cover: { height: 120 },
  gear: { position: 'absolute', top: spacing.md, right: spacing.lg, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  identity: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -44 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  pencil: { position: 'absolute', right: -2, top: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.xl },
  stat: { gap: 2 },
  statValue: { fontFamily: fonts.displayHeavy, fontSize: 22 },
  tabs: { flexDirection: 'row', marginTop: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: spacing.md, marginRight: spacing.xl, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  body: { padding: spacing.lg, gap: spacing.md },
  tiles: { gap: spacing.md, paddingVertical: spacing.sm },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, padding: spacing.md, justifyContent: 'space-between', overflow: 'hidden' },
  tileCover: { ...StyleSheet.absoluteFill },
  tileShade: { ...StyleSheet.absoluteFill, backgroundColor: '#00000066' },
  tileLevel: { color: '#FFFFFF', fontFamily: fonts.displayHeavy, fontSize: 30 },
  tileName: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 14 },
  tileCaption: { color: '#FFFFFFB3', fontFamily: fonts.display, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileNew: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  prefs: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
