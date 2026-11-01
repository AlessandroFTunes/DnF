import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Badge, FooterBar, Header, IconButton } from '../../../components';
import { useCharacterDraft } from '../functions/draft';
import { EDITION_INFO, type IconName } from '../functions/labels';
import { useSteps, type StepId } from '../functions/steps';

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
      <Header
        action={{ kind: step ? 'back' : 'close', onPress: () => (router.canGoBack() ? router.back() : close()) }}
        title="Novo personagem"
        center={draft.edition && step ? <Badge icon="dice-d20" label={`D&D ${EDITION_INFO[draft.edition].title}`} /> : undefined}
        right={step ? <IconButton icon="close" label="Cancelar criação" onPress={close} /> : undefined}
      />

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

      <FooterBar>
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
      </FooterBar>
    </SafeAreaView>
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


const styles = StyleSheet.create({
  screen: { flex: 1 },
  progressBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs, gap: spacing.sm },
  progress: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 5, borderRadius: radius.pill },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { gap: spacing.xs, marginBottom: spacing.sm },
  secondary: { flex: 1 },
  primary: { flex: 2 },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoIcon: { marginTop: 1 },
  infoText: { flex: 1 },
});
