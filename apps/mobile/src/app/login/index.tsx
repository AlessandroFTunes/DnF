import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';
import { Button, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Field } from '../../features/auth/Field';
import { useAuthFlow } from '../../features/auth/flow';

/**
 * Primeira etapa: só o email. O servidor diz se já há conta com ele; a próxima etapa pede a senha
 * (entrar) ou nome e senha nova (criar conta).
 */
export default function EmailStep() {
  const theme = useRpgTheme();
  const router = useRouter();
  const flow = useAuthFlow();
  const [email, setEmail] = useState(flow.email);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function next() {
    if (busy) return;
    const parsed = User.Email.safeParse(email);
    if (!parsed.success) {
      setError('Informe um email válido.');
      return;
    }
    setBusy(true);
    try {
      const found = await User.lookupEmail.force({ email: parsed.data });
      flow.setEmail(parsed.data);
      flow.setMode(found.exists ? 'login' : 'signUp');
      flow.setFirstName(found.exists ? (found.firstName ?? null) : null);
      router.push('/login/password');
    } catch (e) {
      setError(
        e instanceof ClientResponseError && e.status === 429
          ? 'Muitas tentativas. Espere um pouco e tente de novo.'
          : e instanceof ClientResponseError && e.status === 0
            ? 'Sem conexão com o servidor. Tente de novo.'
            : 'Algo deu errado. Tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.step}>
      <Text style={[typography.body, { color: theme.textMuted }]}>
        Informe seu email. Se já tiver conta, você entra; se não, criamos uma.
      </Text>
      <Field
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(undefined);
        }}
        error={error}
        autoFocus
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={next}
        submitBehavior="submit"
      />
      <Button label="Continuar" onPress={next} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.md },
});
