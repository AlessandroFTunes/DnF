import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mesa } from '@dnf/core/mesa';
import { Button, DnfSpinner, fonts, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Badge, Header, HighlightCard, ListCard, PageHeading } from '../../../components';
import { classIcon } from '../../character-create/functions/labels';
import { formatCode } from '../functions/code';
import { useSession } from '../../auth/functions/hook.session';
import { srd, tr, useSrd } from '../../srd/functions';

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
      <Header
        action={{ kind: 'back', onPress: back }}
        right={<Badge icon={isGM ? 'crown-outline' : 'account-outline'} label={isGM ? 'MESTRE' : 'JOGADOR'} solid={isGM} />}
      />

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
        <PageHeading icon="castle" title={mesa.name} overline={`D&D ${mesa.edition}`} subtitle={mesa.description || undefined} />

        {isGM && (
          <HighlightCard center>
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
          </HighlightCard>
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
    <ListCard
      title={c.name}
      subtitle={[className, `Nível ${c.level}`].filter(Boolean).join(' · ')}
      icon={classIcon(className ?? '')}
      tone="accent"
      accessibilityLabel={`Abrir ficha de ${c.name}`}
      onPress={onOpen}
      style={styles.member}
    >
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
    </ListCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  code: { fontFamily: fonts.displayHeavy, fontSize: 40, letterSpacing: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  partyHeader: { flexDirection: 'row', alignItems: 'center' },
  party: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  member: { flexGrow: 1, flexBasis: 280 },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  memberAction: { alignSelf: 'flex-end', padding: spacing.xs },
});
