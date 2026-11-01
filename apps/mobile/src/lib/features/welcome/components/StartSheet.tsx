import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { D20, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { AuthButton } from '../auth/AuthButton';

const useNativeDriver = Platform.OS !== 'web';

export interface StartSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Única forma de entrar por enquanto; telefone, Apple e Google aparecem como "em breve". */
  onEmail: () => void;
}

/** Folha que sobe de baixo com as formas de entrar no app. */
export function StartSheet({ visible, onClose, onEmail }: StartSheetProps) {
  const theme = useRpgTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));

  // O Modal fica montado até a folha terminar de descer (monta já no render em que abre).
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      Animated.timing(progress, {
        toValue: visible ? 1 : 0,
        duration: reduce ? 0 : visible ? 380 : 240,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver,
      }).start(({ finished }) => {
        if (finished && !visible) setMounted(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
      </Animated.View>

      <View style={[styles.dock, { bottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
            shadow(theme, 3),
            {
              opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.top}>
            <View style={[styles.badge, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
              <D20 size={34} value={null} />
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={8}
              style={[styles.close, { backgroundColor: theme.surfaceSunken }]}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.textMuted} />
            </Pressable>
          </View>

          <Text style={[typography.title, { color: theme.text }]}>Começar</Text>
          <Text style={[typography.body, styles.text, { color: theme.textMuted }]}>
            Crie seus personagens, entre nas mesas dos amigos e acompanhe cada aventura.
          </Text>

          <AuthButton
            variant="primary"
            label="Continuar com email"
            icon={(color) => <MaterialCommunityIcons name="email-outline" size={20} color={color} />}
            onPress={onEmail}
          />
          <AuthButton
            label="Continuar com telefone"
            icon={(color) => <MaterialCommunityIcons name="phone-outline" size={20} color={color} />}
            soon
          />
          <View style={styles.row}>
            <AuthButton
              label="Apple"
              iconOnly
              icon={(color) => <MaterialCommunityIcons name="apple" size={22} color={color} />}
              soon
              style={styles.flex}
            />
            <AuthButton
              label="Google"
              iconOnly
              icon={(color) => <MaterialCommunityIcons name="google" size={20} color={color} />}
              soon
              style={styles.flex}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A folha flutua acima da borda de baixo; em telas largas (web) fica centrada com no máximo 480 px.
  dock: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, borderRadius: 32, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  badge: { width: 56, height: 56, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  close: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
