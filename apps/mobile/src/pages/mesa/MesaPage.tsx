import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mesa } from '@dnf/core/mesa';
import { Button, DnfSpinner, fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { classIcon } from '../../features/character-create/labels';
import { formatCode } from '../../features/mesa/code';
import { useSession } from '../../hooks/hook.session';
import { srd, tr, useSrd } from '../../lib/srd';

// Sem realtime no React Native (o SDK usa EventSource): a mesa se atualiza sozinha a cada 10 s.
const POLL_MS = 10_000;

export default function MesaPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const session = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mesa, setMesa] = useState<Mesa.Info | null>(null);
  const [members, setMembers] = useState<Mesa.Member[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [found, list] = await Promise.all([Mesa.fromID(id), Mesa.members(id)]);
      setMesa(found);
      setMembers(list);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const userID = session.status === 'signedIn' ? session.session.userID : null;
  const isGM = !!mesa && mesa.gmID === userID;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** Ações destrutivas pedem um segundo toque (Alert não existe na web). */
  const confirmThen = (key: string, action: () => Promise<void>) => {
    if (confirming !== key) {
      setConfirming(key);
      return;
    }
    setConfirming(null);
    void action();
  };

  if (status !== 'ready' || !mesa) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.surface }]}>
        {status === 'loading' ? (
          <DnfSpinner size={56} />
        ) : (
          <>
            <Text style={[typography.heading, { color: theme.text }]}>
              {status === 'missing' ? 'Mesa não encontrada' : 'Não deu para abrir a mesa'}
            </Text>
            <Button label="Voltar" variant="secondary" onPress={back} />
          </>
        )}
      </SafeAreaView>
    );
  }

  const totalHp = members.reduce((sum, m) => sum + m.character.combat.hpCurrent, 0);
  const totalMax = members.reduce((sum, m) => sum + m.character.combat.hpMax, 0);

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
        <View style={[styles.role, { backgroundColor: isGM ? theme.accent : theme.goldSoft, borderColor: isGM ? theme.accent : theme.gold }]}>
          <MaterialCommunityIcons name={isGM ? 'crown-outline' : 'account-outline'} size={14} color={isGM ? theme.accentText : theme.gold} />
          <Text style={[styles.roleText, { color: isGM ? theme.accentText : theme.gold }]}>{isGM ? 'MESTRE' : 'JOGADOR'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.heading}>
          <MaterialCommunityIcons name="castle" size={36} color={theme.gold} />
          <Text style={[typography.title, { color: theme.text, textAlign: 'center' }]}>{mesa.name}</Text>
          <Text style={[typography.overline, { color: theme.gold }]}>D&D {mesa.edition}</Text>
          {mesa.description ? (
            <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>{mesa.description}</Text>
          ) : null}
        </View>

        {isGM && (
          <View style={[styles.invite, { backgroundColor: theme.surfaceRaised, borderColor: theme.gold }, shadow(theme, 2)]}>
            <Text style={[typography.overline, { color: theme.textMuted }]}>Código de convite</Text>
            <Text style={[styles.code, { color: theme.accent }]} selectable accessibilityLabel={`Código ${mesa.inviteCode.split('').join(' ')}`}>
              {formatCode(mesa.inviteCode)}
            </Text>
            <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>
              Os jogadores entram com este código e um personagem de D&D {mesa.edition}.
            </Text>
            <View style={styles.row}>
              <Button
                label="Compartilhar"
                onPress={() =>
                  void Share.share({ message: `Entre na minha mesa "${mesa.name}" no DnF com o código ${formatCode(mesa.inviteCode)}` })
                }
                style={styles.flex}
                icon={(c) => <MaterialCommunityIcons name="share-variant-outline" size={18} color={c} />}
              />
              <Button
                label={confirming === 'code' ? 'Confirmar' : 'Novo código'}
                variant="secondary"
                onPress={() => confirmThen('code', async () => setMesa(await Mesa.newInviteCode(mesa.id)))}
                icon={(c) => <MaterialCommunityIcons name="refresh" size={18} color={c} />}
              />
            </View>
          </View>
        )}

        <View style={styles.partyHeader}>
          <Text style={[typography.overline, { color: theme.textMuted, flex: 1 }]}>
            {isGM ? `Grupo · ${members.length} aventureiro${members.length === 1 ? '' : 's'}` : 'Seu personagem nesta mesa'}
          </Text>
          {isGM && members.length > 0 && (
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              PV do grupo {totalHp}/{totalMax}
            </Text>
          )}
        </View>

        {members.length === 0 && (
          <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>
            {isGM ? 'Ninguém entrou ainda. Compartilhe o código!' : '—'}
          </Text>
        )}

        <View style={styles.party}>
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onOpen={() => router.push(`/character/${m.character.id}`)}
              actionLabel={isGM ? (confirming === m.id ? 'Confirmar remoção' : 'Remover') : confirming === m.id ? 'Confirmar saída' : 'Sair da mesa'}
              onAction={() =>
                confirmThen(m.id, async () => {
                  await Mesa.removeMember(m.id);
                  if (isGM) await load();
                  else back();
                })
              }
            />
          ))}
        </View>

        {isGM && (
          <Button
            label={confirming === 'delete' ? 'Toque de novo para apagar a mesa' : 'Apagar mesa'}
            variant="ghost"
            onPress={() =>
              confirmThen('delete', async () => {
                await Mesa.remove(mesa.id);
                back();
              })
            }
            icon={(c) => <MaterialCommunityIcons name="delete-outline" size={18} color={c} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberCard({
  member,
  onOpen,
  actionLabel,
  onAction,
}: {
  member: Mesa.Member;
  onOpen: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useRpgTheme();
  const c = member.character;
  const classKey = c.classes[0]?.classKey ?? '';
  const classes = useSrd(`classes:${c.edition}`, () => srd.classes(c.edition));
  const found = classes.status === 'ready' ? classes.data.find((k) => k.key === classKey) : undefined;
  const className = found ? tr.name(found) : undefined;
  const ratio = c.combat.hpMax ? c.combat.hpCurrent / c.combat.hpMax : 0;
  const color = c.combat.hpCurrent === 0 ? theme.negative : ratio > 0.5 ? theme.positive : ratio > 0.25 ? theme.gold : theme.negative;

  return (
    <View style={[styles.member, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, shadow(theme, 1)]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${c.name}`} style={styles.memberTop}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name={classIcon(classKey)} size={24} color={theme.accentText} />
        </View>
        <View style={styles.flex}>
          <Text style={[typography.subheading, { color: theme.text }]} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={[typography.caption, { color: theme.textMuted }]}>{[className, `Nível ${c.level}`].filter(Boolean).join(' · ')}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>
      <View style={styles.hpRow}>
        <MaterialCommunityIcons name={c.combat.hpCurrent === 0 ? 'skull-outline' : 'heart'} size={16} color={color} />
        <View style={[styles.bar, { backgroundColor: theme.surfaceSunken }]}>
          <View style={[styles.barFill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: color }]} />
        </View>
        <Text style={[typography.caption, { color: theme.text, fontWeight: '800' }]}>
          {c.combat.hpCurrent}/{c.combat.hpMax}
          {c.combat.hpTemp ? ` +${c.combat.hpTemp}` : ''}
        </Text>
      </View>
      {c.inspiration && (
        <Text style={[typography.caption, { color: theme.gold }]}>★ Com inspiração</Text>
      )}
      <Pressable onPress={onAction} accessibilityRole="button" style={styles.memberAction}>
        <Text style={[typography.caption, { color: theme.negative, fontWeight: '700' }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  role: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  heading: { alignItems: 'center', gap: spacing.xs },
  invite: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  code: { fontFamily: fonts.displayHeavy, fontSize: 40, letterSpacing: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  partyHeader: { flexDirection: 'row', alignItems: 'center' },
  party: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  member: { flexGrow: 1, flexBasis: 280, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  memberAction: { alignSelf: 'flex-end', padding: spacing.xs },
});
