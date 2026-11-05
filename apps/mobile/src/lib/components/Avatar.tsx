import { Image, StyleSheet, Text, View } from 'react-native';
import { fonts, useRpgTheme } from '@dnf/ui-react-native';

interface AvatarProps {
  /** Foto do perfil (URL), ou `null` para a inicial do nome. */
  uri: string | null;
  /** Nome ou apelido; a inicial aparece quando não há foto. */
  name: string;
  size?: number;
}

/** Círculo com a foto do jogador, ou a inicial do nome sobre o vermelho do tema. */
export function Avatar({ uri, name, size = 64 }: AvatarProps) {
  const theme = useRpgTheme();
  const frame = { width: size, height: size, borderRadius: size / 2, borderColor: theme.gold };
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel={`Foto de ${name}`} style={[styles.base, frame, { backgroundColor: theme.surfaceSunken }]} />;
  }
  return (
    <View style={[styles.base, styles.center, frame, { backgroundColor: theme.accent }]} accessibilityLabel={`Avatar de ${name}`}>
      <Text style={{ color: theme.accentText, fontFamily: fonts.displayHeavy, fontSize: size * 0.42 }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
