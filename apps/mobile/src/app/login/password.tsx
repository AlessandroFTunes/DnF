import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { User } from '@dnf/core/user';
import { Button, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { toErrors, type AuthErrors, type AuthField } from '../../features/auth/errors';
import { Field } from '../../features/auth/Field';
import { useAuthFlow } from '../../features/auth/flow';
import { useSession } from '../../hooks/hook.session';

/** Segunda etapa: senha para entrar; nome, senha e confirmação para criar a conta. */
export default function PasswordStep() {
  const theme = useRpgTheme();
  const router = useRouter();
  const { login, signUp } = useSession();
  const { mode, email, firstName } = useAuthFlow();
  const [form, setForm] = useState({ name: '', password: '', passwordConfirm: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [busy, setBusy] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const isSignUp = mode === 'signUp';

  // Recarregou a página (web) ou abriu o link direto: o email ficou para trás.
  if (!email) return <Redirect href="/login" />;

  const set = (field: Exclude<AuthField, 'email'>) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  };

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      // Ao logar, o useSession troca para a área logada sozinho (Stack.Protected).
      if (isSignUp) await signUp({ ...form, email });
      else await login({ email, password: form.password });
    } catch (error) {
      setErrors(toErrors(error, mode));
      setBusy(false);
    }
  }

  // Erro no email (ex.: já cadastrado) aparece aqui em cima, junto do email, já que o campo ficou na etapa anterior.
  const formError = errors.email ?? errors.form;

  return (
    <View style={styles.step}>
      <Text style={[typography.title, { color: theme.text }]} accessibilityRole="header">
        {isSignUp ? 'Boas-vindas, aventureiro' : firstName ? `Bem-vindo de volta, ${firstName}` : 'Bem-vindo de volta'}
      </Text>
      <Text style={[typography.body, styles.lead, { color: theme.textMuted }]}>
        {isSignUp ? 'Ainda não há conta com esse email. Vamos criar a sua.' : 'Digite sua senha para continuar.'}
      </Text>

      <Pressable
        onPress={() => router.back()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${email}, alterar email`}
        style={[styles.email, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
      >
        <MaterialCommunityIcons name="email-outline" size={18} color={theme.textMuted} />
        <Text style={[typography.bodyStrong, styles.emailText, { color: theme.text }]} numberOfLines={1}>
          {email}
        </Text>
        <Text style={[typography.caption, { color: theme.accent, fontWeight: '700' }]}>Alterar</Text>
      </Pressable>

      {isSignUp && (
        <Field
          label="Nome"
          value={form.name}
          onChangeText={set('name')}
          error={errors.name}
          autoFocus
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
      )}
      <Field
        ref={passwordRef}
        label="Senha"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        hint={isSignUp ? `Mínimo de ${User.PASSWORD_MIN_LENGTH} caracteres` : undefined}
        autoFocus={!isSignUp}
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        textContentType={isSignUp ? 'newPassword' : 'password'}
        returnKeyType={isSignUp ? 'next' : 'go'}
        onSubmitEditing={isSignUp ? () => confirmRef.current?.focus() : submit}
        submitBehavior={isSignUp ? 'submit' : 'blurAndSubmit'}
      />
      {isSignUp && (
        <Field
          ref={confirmRef}
          label="Confirmar senha"
          value={form.passwordConfirm}
          onChangeText={set('passwordConfirm')}
          error={errors.passwordConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      )}

      {formError && (
        <Text style={[styles.formError, { color: theme.negative }]} accessibilityLiveRegion="polite">
          {formError}
        </Text>
      )}

      <Button label={isSignUp ? 'Criar conta' : 'Entrar'} onPress={submit} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.md },
  email: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emailText: { flex: 1 },
  lead: { marginTop: -spacing.sm },
  formError: { fontSize: 14, textAlign: 'center' },
});
