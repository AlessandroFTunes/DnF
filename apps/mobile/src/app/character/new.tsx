import { StyleSheet, Text, View } from 'react-native';
import { DnfLogo, spacing, useRpgTheme } from '@dnf/ui-react-native';

// TODO: fluxo de criação (classe, espécie, antecedente, atributos) com dados da Open5e.
export default function NewCharacter() {
  const theme = useRpgTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <DnfLogo size={90} showName={false} />
      <Text style={[styles.title, { color: theme.text }]}>Criação de personagem</Text>
      <Text style={{ color: theme.textMuted, textAlign: 'center' }}>Em breve.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700' },
});
