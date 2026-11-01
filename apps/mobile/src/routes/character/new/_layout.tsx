import { Stack } from 'expo-router';
import { useRpgTheme } from '@dnf/ui-react-native';
import { CharacterDraftProvider } from '../../../features/character-create/draft';

/** Fluxo de criação: as etapas compartilham o rascunho; cada tela desenha o próprio cabeçalho. */
export default function NewCharacterLayout() {
  const theme = useRpgTheme();
  return (
    <CharacterDraftProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface } }} />
    </CharacterDraftProvider>
  );
}
