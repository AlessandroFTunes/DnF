import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, DnfSpinner, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { useCharacterDraft } from './draft';
import { EDITION_INFO, type IconName } from './labels';
import { useSteps, type StepId } from './steps';

interface StepScreenProps {
  /** Etapa atual; omita na escolha de edição (antes das etapas). */
  step?: StepId;
  title: string;
  subtitle?: string;
  children: ReactNode;
  canContinue: boolean;
  /** Padrão: vai para a próxima etapa. */
  onContinue?: () => void;
  continueLabel?: string;
  continueLoading?: boolean;
  /** Ação secundária ao lado do "Continuar" (ex.: "Pular"). */
  secondary?: { label: string; onPress: () => void };
}

/** Moldura de cada etapa: barra de progresso, título, conteúdo rolável e rodapé com as ações. */
export function StepScreen({
  step,
  title,
  subtitle,
  children,
  canContinue,
  onContinue,
  continueLabel = 'Continuar',
  continueLoading,
  secondary,
}: StepScreenProps) {
  const theme = useRpgTheme();
  const router = useRouter();
  const { draft } = useCharacterDraft();
  const steps = useSteps();

  // Abriu uma etapa direto (ex.: recarregou a página na web) sem escolher a edição.
  if (step && !draft.edition) return <Redirect href="/character/new" />;

  const index = step ? steps.findIndex((s) => s.id === step) : -1;
  const next = step ? steps[index + 1] : steps[0];
  const goNext = onContinue ?? (() => next && router.push(next.href));
  const close = () => router.dismissTo('/');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <IconButton
          icon={step ? 'chevron-left' : 'close'}
          label={step ? 'Voltar' : 'Cancelar'}
          onPress={() => (router.canGoBack() ? router.back() : close())}
        />
        <View style={styles.topCenter}>
          {draft.edition && step ? (
            <View style={[styles.editionChip, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
              <MaterialCommunityIcons name="dice-d20" size={13} color={theme.gold} />
              <Text style={[styles.editionText, { color: theme.gold }]}>D&D {EDITION_INFO[draft.edition].title}</Text>
            </View>
          ) : (
            <Text style={[typography.overline, { color: theme.textMuted }]}>Novo personagem</Text>
          )}
        </View>
        {step ? <IconButton icon="close" label="Cancelar criação" onPress={close} /> : <View style={styles.iconSpacer} />}
      </View>

      {step && (
        <View style={styles.progressBlock}>
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}>
            {steps.map((s, i) => (
              <View
                key={s.id}
                style={[styles.segment, { backgroundColor: i <= index ? theme.accent : theme.surfaceSunken }]}
              />
            ))}
          </View>
          <Text style={[typography.overline, { color: theme.textMuted }]}>
            Etapa {index + 1} de {steps.length} · {steps[index]?.label}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={[typography.title, { color: theme.text }]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={[typography.body, { color: theme.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
        {secondary && (
          <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} style={styles.secondary} />
        )}
        <Button
          label={continueLabel}
          onPress={goNext}
          disabled={!canContinue}
          loading={continueLoading}
          style={styles.primary}
          trailingIcon={(color) => <MaterialCommunityIcons name="arrow-right" size={18} color={color} />}
        />
      </View>
    </SafeAreaView>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useRpgTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceSunken : theme.surfaceRaised },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.text} />
    </Pressable>
  );
}

/** Carregando / falhou ao buscar na 5e-FastAPI. */
export function LoadState({ status, onRetry }: { status: 'loading' | 'error'; onRetry: () => void }) {
  const theme = useRpgTheme();
  if (status === 'loading') {
    return (
      <View style={styles.loadState}>
        <DnfSpinner size={44} />
        <Text style={[typography.caption, { color: theme.textMuted }]}>Consultando o compêndio…</Text>
      </View>
    );
  }
  return (
    <View style={styles.loadState}>
      <MaterialCommunityIcons name="wifi-off" size={28} color={theme.textMuted} />
      <Text style={[typography.bodyStrong, { color: theme.text }]}>Não deu para falar com a API de regras</Text>
      <Button label="Tentar de novo" variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** Linha "rótulo: valor" usada nos detalhes dos cards. */
export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={16} color={theme.gold} style={styles.infoIcon} />
      <Text style={[typography.caption, styles.infoText, { color: theme.text }]}>
        <Text style={{ fontWeight: '700' }}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

/** Título pequeno de seção dentro de uma etapa. */
export function SectionLabel({ children }: { children: string }) {
  const theme = useRpgTheme();
  return <Text style={[typography.overline, { color: theme.textMuted, marginTop: spacing.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  topCenter: { flex: 1, alignItems: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: { width: 40 },
  editionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editionText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  progressBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs, gap: spacing.sm },
  progress: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 5, borderRadius: radius.pill },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { gap: spacing.xs, marginBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondary: { flex: 1 },
  primary: { flex: 2 },
  loadState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoIcon: { marginTop: 1 },
  infoText: { flex: 1 },
});
