import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import type { IconName } from '../character-create/labels';

const useNativeDriver = Platform.OS !== 'web';

/** Folha que sobe de baixo com um título e conteúdo rolável. */
export function BottomSheet({
  visible,
  onClose,
  title,
  icon,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  children: ReactNode;
}) {
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
        duration: reduce ? 0 : visible ? 320 : 220,
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

      <View style={styles.dock} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.surfaceRaised, borderColor: theme.border, paddingBottom: insets.bottom + spacing.md },
            shadow(theme, 3),
            { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            {icon && <MaterialCommunityIcons name={icon} size={20} color={theme.gold} />}
            <Text style={[typography.heading, styles.flex, { color: theme.text }]}>{title}</Text>
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
          <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Presa na borda de baixo; em telas largas (web) fica centrada com no máximo 560 px.
  dock: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  close: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  flex: { flex: 1 },
});
