import { useCallback, useContext, useState } from 'react';
import { GOLD_DIE, LevelUpCelebration, PURPLE_DIE, type LevelUpGain } from '../LevelUpCelebration';
import { ClassTree, type Fresh } from '../progression/ClassTree';
import { MAX_LEVEL } from '../progression/sky';
import { ThemeHold } from '../themeBlend';
import type { Sheet } from '../useSheet';

/**
 * Árvore de evolução. A página só decide o que mostrar: subiu de nível → animação do d20 (roxo ao chegar
 * no 20); senão → a árvore da classe.
 */
export function Progression({ sheet }: { sheet: Sheet }) {
  const holdTheme = useContext(ThemeHold);
  const [celebration, setCelebration] = useState<{ level: number; gains: LevelUpGain[] } | null>(null);
  // Depois de subir: as habilidades do nível novo brilham até o jogador tocar nelas.
  const [fresh, setFresh] = useState<Fresh | null>(null);

  const onSeen = useCallback(
    (id: string) => setFresh((f) => (f && !f.seen.includes(id) ? { ...f, seen: [...f.seen, id] } : f)),
    [],
  );
  const onLevelUp = useCallback((level: number, gains: LevelUpGain[]) => {
    setCelebration({ level, gains });
    setFresh({ level, seen: [] });
  }, []);

  const { character, derived } = sheet;
  if (!character || !derived) return null;

  if (celebration) {
    return (
      <LevelUpCelebration
        level={celebration.level}
        gains={celebration.gains}
        palette={celebration.level >= MAX_LEVEL ? PURPLE_DIE : GOLD_DIE}
        onClose={() => {
          setCelebration(null);
          holdTheme(false);
        }}
      />
    );
  }

  return <ClassTree sheet={sheet} derived={derived} fresh={fresh} onSeen={onSeen} onLevelUp={onLevelUp} />;
}
