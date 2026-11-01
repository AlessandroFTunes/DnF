import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, DnfSpinner, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';

interface LoadStateProps {
  status: 'loading' | 'error';
  onRetry: () => void;
  /** Texto sob o spinner. */
  loadingText?: string;
  /** Título do erro. */
  errorText?: string;
  /** Ocupa a tela toda, centralizado (padrão: bloco dentro do conteúdo). */
  fill?: boolean;
}

/** Carregando / falhou, com "Tentar de novo". */
export function LoadState({
  status,
  onRetry,
  loadingText = 'Consultando o compêndio…',
  errorText = 'Não deu para falar com a API de regras',
  fill,
}: LoadStateProps) {
  const theme = useRpgTheme();
  return (
    <View style={[styles.box, fill && styles.fill]}>
      {status === 'loading' ? (
        <>
          <DnfSpinner size={fill ? 56 : 44} />
          {loadingText ? <Text style={[typography.caption, { color: theme.textMuted }]}>{loadingText}</Text> : null}
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="wifi-off" size={28} color={theme.textMuted} />
          <Text style={[typography.bodyStrong, styles.centered, { color: theme.text }]}>{errorText}</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={onRetry} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  fill: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  centered: { textAlign: 'center' },
});
