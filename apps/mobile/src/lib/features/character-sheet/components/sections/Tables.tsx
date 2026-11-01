import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mesa } from '@dnf/core/mesa';
import { Button, DnfSpinner, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { Panel } from '../components';
import type { Sheet } from '../useSheet';

/** Mesas em que o personagem está, e o atalho para entrar em outra. */
export function Tables({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const router = useRouter();
  const { character, isOwner } = sheet;
  const [list, setList] = useState<{ memberID: string; mesa: Mesa.Info }[] | null>(null);

  const characterID = character?.id;
  useEffect(() => {
    if (!characterID) return;
    let active = true;
    Mesa.ofCharacter(characterID).then(
      (found) => active && setList(found),
      () => active && setList([]),
    );
    return () => {
      active = false;
    };
  }, [characterID]);

  if (!character) return null;

  return (
    <Panel title="Mesas" icon="castle">
      {list === null ? (
        <DnfSpinner size={36} />
      ) : list.length === 0 ? (
        <Text style={[typography.body, { color: theme.textMuted }]}>
          {isOwner ? 'Ainda não está em nenhuma mesa. Peça o código ao mestre.' : '—'}
        </Text>
      ) : (
        list.map(({ memberID, mesa }) => (
          <Pressable
            key={memberID}
            onPress={() => router.push(`/mesa/${mesa.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="castle" size={20} color={theme.gold} />
            <View style={styles.flex}>
              <Text style={[typography.bodyStrong, { color: theme.text }]}>{mesa.name}</Text>
              <Text style={[typography.caption, { color: theme.textMuted }]}>D&D {mesa.edition}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        ))
      )}
      {isOwner && (
        <Button
          label="Entrar numa mesa"
          variant="secondary"
          onPress={() => router.push({ pathname: '/mesa/join', params: { characterID: character.id } })}
          icon={(c) => <MaterialCommunityIcons name="door-open" size={18} color={c} />}
        />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
});
