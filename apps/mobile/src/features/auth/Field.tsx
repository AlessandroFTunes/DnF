import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';

export interface FieldProps extends TextInputProps {
  ref?: React.Ref<TextInput>;
  label: string;
  error?: string;
  hint?: string;
}

/** Campo de texto com rótulo em cima e erro/dica embaixo. */
export function Field({ ref, label, error, hint, style, ...props }: FieldProps) {
  const theme = useRpgTheme();
  return (
    <View style={styles.field}>
      <Text style={[typography.caption, styles.label, { color: theme.text }]}>{label}</Text>
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

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16 },
  help: { fontSize: 12 },
});
