import { Slot, usePathname, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { AuthButton } from '../../features/auth/AuthButton';
import { AuthFlowProvider, useAuthFlow } from '../../features/auth/flow';

/**
 * Moldura do fluxo de entrar/criar conta: cabeçalho em cima e o corte de baixo ("ou" + Apple/Google)
 * ficam fixos; as etapas (email → senha) entram no meio, pelo <Slot />.
 */
export default function LoginLayout() {
  return (
    <AuthFlowProvider>
      <Frame />
    </AuthFlowProvider>
  );
}

function Frame() {
  const theme = useRpgTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { mode } = useAuthFlow();
  const firstStep = pathname === '/login';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: theme.border }]}>
        <View style={styles.side}>
          {!firstStep && (
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.text} />
            </Pressable>
          )}
        </View>
        <Text style={[typography.subheading, { color: theme.text }]} accessibilityRole="header">
          {firstStep ? 'Entrar ou criar conta' : mode === 'signUp' ? 'Criar conta' : 'Entrar'}
        </Text>
        <View style={[styles.side, styles.right]}>
          <Pressable
            onPress={() => router.dismissTo('/welcome')}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.step}>
          <Slot />
        </View>

        <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <Text style={[typography.caption, { color: theme.textMuted }]}>ou</Text>
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
        </View>

        <AuthButton
          variant="outline"
          label="Continuar com Apple"
          icon={(color) => <MaterialCommunityIcons name="apple" size={22} color={color} />}
          soon
        />
        <AuthButton
          variant="outline"
          label="Continuar com Google"
          icon={(color) => <MaterialCommunityIcons name="google" size={20} color={color} />}
          soon
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 32 },
  right: { alignItems: 'flex-end' },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  step: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
