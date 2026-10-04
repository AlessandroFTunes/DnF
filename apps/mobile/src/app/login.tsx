import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { z } from 'zod';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';
import { DnfLogo, radius, spacing, useRpgTheme, type RpgTheme } from '@dnf/ui-react-native';
import { useSession } from '../hooks/hook.session';

type Mode = 'login' | 'signUp';
type Field = 'name' | 'email' | 'password' | 'passwordConfirm';
type Errors = Partial<Record<Field | 'form', string>>;

export default function Login() {
  const theme = useRpgTheme();
  const { login, signUp } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const isSignUp = mode === 'signUp';
  const set = (field: Field) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  };

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      // Ao logar, o useSession troca para a área logada sozinho (Stack.Protected).
      if (isSignUp) await signUp(form);
      else await login({ email: form.email, password: form.password });
    } catch (error) {
      setErrors(toErrors(error, mode));
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignUp ? 'login' : 'signUp');
    setErrors({});
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DnfLogo size={120} style={styles.logo} />
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {isSignUp ? 'Crie sua conta para começar a aventura' : 'Entre para continuar sua aventura'}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          {isSignUp && (
            <Input
              theme={theme}
              label="Nome"
              value={form.name}
              onChangeText={set('name')}
              error={errors.name}
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              submitBehavior="submit"
            />
          )}
          <Input
            ref={emailRef}
            theme={theme}
            label="Email"
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            autoComplete="email"
            textContentType={isSignUp ? 'emailAddress' : 'username'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <Input
            ref={passwordRef}
            theme={theme}
            label="Senha"
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
            hint={isSignUp ? `Mínimo de ${User.PASSWORD_MIN_LENGTH} caracteres` : undefined}
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            returnKeyType={isSignUp ? 'next' : 'go'}
            onSubmitEditing={isSignUp ? () => confirmRef.current?.focus() : submit}
            submitBehavior={isSignUp ? 'submit' : 'blurAndSubmit'}
          />
          {isSignUp && (
            <Input
              ref={confirmRef}
              theme={theme}
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

          {errors.form && (
            <Text style={[styles.formError, { color: theme.negative }]} accessibilityLiveRegion="polite">
              {errors.form}
            </Text>
          )}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accent, opacity: pressed || busy ? 0.75 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.accentText }]}>
                {isSignUp ? 'Criar conta' : 'Entrar'}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={switchMode} disabled={busy} accessibilityRole="button" style={styles.switch}>
          <Text style={{ color: theme.textMuted }}>
            {isSignUp ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <Text style={{ color: theme.accent, fontWeight: '700' }}>{isSignUp ? 'Entrar' : 'Criar conta'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface InputProps extends TextInputProps {
  ref?: React.Ref<TextInput>;
  theme: RpgTheme;
  label: string;
  error?: string;
  hint?: string;
}

function Input({ ref, theme, label, error, hint, style, ...props }: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.negative : theme.border },
          style,
        ]}
        {...props}
      />
      {(error ?? hint) && (
        <Text style={[styles.help, { color: error ? theme.negative : theme.textMuted }]}>{error ?? hint}</Text>
      )}
    </View>
  );
}

/** Traduz erros de validação (Zod) e do servidor (PocketBase) para mensagens por campo. */
function toErrors(error: unknown, mode: Mode): Errors {
  if (error instanceof z.ZodError) {
    const errors: Errors = {};
    for (const issue of error.issues) {
      const field = issue.path[0] as Field;
      errors[field] ??= fieldMessage(field, issue.code, mode);
    }
    return errors;
  }
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return { form: 'Sem conexão com o servidor. Tente de novo.' };
    if (mode === 'login' && error.status === 400) return { form: 'Email ou senha incorretos.' };
    if (error.response?.data?.email?.code === 'validation_not_unique') {
      return { email: 'Já existe uma conta com esse email.' };
    }
    if (error.status === 429) return { form: 'Muitas tentativas. Espere um pouco e tente de novo.' };
  }
  return { form: 'Algo deu errado. Tente de novo.' };
}

function fieldMessage(field: Field, code: string, mode: Mode): string {
  switch (field) {
    case 'name':
      return 'Informe seu nome.';
    case 'email':
      return 'Informe um email válido.';
    case 'password':
      if (mode === 'login') return 'Informe sua senha.';
      return code === 'too_big' ? 'Senha longa demais.' : `A senha precisa de pelo menos ${User.PASSWORD_MIN_LENGTH} caracteres.`;
    case 'passwordConfirm':
      return 'As senhas não conferem.';
  }
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  logo: { alignSelf: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: -spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  field: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16 },
  help: { fontSize: 12 },
  formError: { fontSize: 14, textAlign: 'center' },
  button: { borderRadius: radius.sm, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  buttonText: { fontSize: 16, fontWeight: '700' },
  switch: { alignSelf: 'center', padding: spacing.sm },
});
