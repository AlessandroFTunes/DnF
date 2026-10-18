import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing, touchTarget, typography, useRpgTheme } from '@dnf/ui-react-native';

export interface FieldProps extends TextInputProps {
  ref?: React.Ref<TextInput>;
  label: string;
  error?: string;
  hint?: string;
}

/** Campo de texto com rótulo em cima e erro/dica embaixo. Campos de senha ganham o botão de mostrar/ocultar. */
export function Field({ ref, label, error, hint, style, secureTextEntry, ...props }: FieldProps) {
  const theme = useRpgTheme();
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.field}>
      <Text style={[typography.caption, styles.label, { color: theme.text }]}>{label}</Text>
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={isPassword && !revealed}
          style={[
            styles.input,
            isPassword && styles.inputWithToggle,
            { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.negative : theme.border },
            style,
          ]}
          {...props}
        />
        {isPassword && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            accessibilityState={{ checked: revealed }}
            hitSlop={4}
            style={styles.toggle}
          >
            <MaterialCommunityIcons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textMuted} />
          </Pressable>
        )}
      </View>
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
  // Espaço à direita para o texto não passar por baixo do olho.
  inputWithToggle: { paddingRight: touchTarget },
  help: { fontSize: 12 },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
