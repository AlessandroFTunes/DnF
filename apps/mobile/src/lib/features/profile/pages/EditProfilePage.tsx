import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { User } from '@dnf/core/user';
import { Button, fonts, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Avatar, FooterBar, Header, SectionLabel } from '../../../components';
import { useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from '../functions/queries';

/** Edita o perfil: foto (guardada no storage do PocketBase), nome e apelido. */
export default function EditProfilePage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const { user } = useProfile();
  const updateProfile = useUpdateProfile();
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [busy, setBusy] = useState<'avatar' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/perfil'));
  const shownName = nickname.trim() || name.trim() || 'Aventureiro';

  async function pickAvatar() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0]!;
    if (asset.fileSize && asset.fileSize > User.AVATAR_MAX_BYTES) {
      setError('A imagem passa de 5 MB.');
      return;
    }
    setBusy('avatar');
    try {
      // Na web o arquivo vira Blob; no celular o PocketBase aceita { uri, name, type } direto.
      const file: User.AvatarFile =
        Platform.OS === 'web'
          ? await (await fetch(asset.uri)).blob()
          : { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' };
      await setAvatar(file);
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith('Use ') ? e.message : 'Não deu para enviar a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  async function dropAvatar() {
    setError(null);
    setBusy('avatar');
    try {
      await removeAvatar();
    } catch {
      setError('Não deu para remover a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setError(null);
    setBusy('save');
    try {
      await updateProfile({ name: name.trim(), nickname: nickname.trim() });
      close();
    } catch {
      setError('Não deu para salvar. Confira o nome e tente de novo.');
      setBusy(null);
    }
  }

  const dirty = name.trim() !== (user?.name ?? '') || nickname.trim() !== (user?.nickname ?? '');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header action={{ kind: 'close', onPress: close }} title="Editar perfil" />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Avatar uri={user?.avatar ?? null} name={shownName} size={120} />
            <View style={styles.row}>
              <Button
                label={user?.avatar ? 'Trocar foto' : 'Escolher foto'}
                variant="secondary"
                onPress={() => void pickAvatar()}
                loading={busy === 'avatar'}
                icon={(c) => <MaterialCommunityIcons name="camera-outline" size={18} color={c} />}
              />
              {user?.avatar ? <Button label="Remover" variant="ghost" onPress={() => void dropAvatar()} disabled={busy !== null} /> : null}
            </View>
          </View>

          <SectionLabel>Nome</SectionLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={64}
            autoCapitalize="words"
            accessibilityLabel="Nome"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />

          <SectionLabel>Apelido (opcional)</SectionLabel>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            maxLength={32}
            placeholder="Como os outros jogadores te veem"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Apelido"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            Com apelido, ele aparece no lugar do nome nas mesas.
          </Text>

          {error && <Text style={[typography.caption, { color: theme.negative }]}>{error}</Text>}
        </ScrollView>

        <FooterBar>
          <Button label="Salvar" onPress={() => void save()} disabled={!name.trim() || !dirty || busy === 'avatar'} loading={busy === 'save'} style={styles.flex} />
        </FooterBar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, fontFamily: fonts.display, fontSize: 18 },
});
