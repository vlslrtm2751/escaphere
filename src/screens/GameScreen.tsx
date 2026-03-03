import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Difficulty, Direction } from '../types/game';
import { useTheme } from '../context/ThemeContext';
import { useGameState } from '../hooks/useGameState';
import { useSfx } from '../hooks/useSfx';
import { useHaptic } from '../hooks/useHaptic';
import { GameBoard } from '../components/game/GameBoard';
import { GameHeader } from '../components/ui/GameHeader';
import { GameToolbar } from '../components/ui/GameToolbar';
import { DirectionPad } from '../components/ui/DirectionPad';
import { PauseMenu } from '../components/ui/PauseMenu';
import { ClearModal } from '../components/ui/ClearModal';
import { saveRecord, getBestRecord, saveStreak, loadStreak } from '../storage/asyncStorage';

type Props = {
  difficulty: Difficulty;
  onHome: () => void;
};

export function GameScreen({ difficulty, onHome }: Props) {
  const { theme } = useTheme();
  const { state, move, undo, hint, refresh, nextStage, restart, completeRespawn } = useGameState(difficulty);
  const { playSfx } = useSfx();
  const haptic = useHaptic();
  const [paused, setPaused] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Handle clear
  useEffect(() => {
    if (state.status === 'cleared') {
      playSfx('clear');
      haptic.triggerClear();
      handleClear();
    } else if (state.status === 'gameover') {
      playSfx('gameover');
      haptic.triggerGameover();
    }
  }, [state.status]);

  const handleClear = async () => {
    const existing = await getBestRecord(state.difficulty);
    if (!existing || state.moveCount < existing.bestMoveCount) {
      await saveRecord({
        difficulty: state.difficulty,
        bestMoveCount: state.moveCount,
        lastUpdated: new Date().toISOString(),
      });
      setIsNewRecord(true);
    } else {
      setIsNewRecord(false);
    }

    // Update streak
    const streak = await loadStreak();
    if (state.hint.usedCount === 0) {
      await saveStreak({
        currentStreak: streak.currentStreak + 1,
        bestStreak: Math.max(streak.bestStreak, streak.currentStreak + 1),
      });
    } else {
      await saveStreak({ ...streak, currentStreak: 0 });
    }
  };

  const handleMove = useCallback((direction: Direction) => {
    if (state.status !== 'playing') return;
    move(direction);
  }, [state.status, move]);

  // PC keyboard arrow key support
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const keyMap: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const handler = (e: KeyboardEvent) => {
      const dir = keyMap[e.key];
      if (dir) { e.preventDefault(); handleMove(dir); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleMove]);

  const handleHint = useCallback(() => {
    hint();
    playSfx('hint');
  }, [hint, playSfx]);

  const handleUndo = useCallback(() => {
    if (state.undoRemaining <= 0 || state.undoStack.length === 0) return;
    undo();
    playSfx('undo');
  }, [state, undo, playSfx]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <GameHeader state={state} onPause={() => setPaused(true)} />

      <View style={styles.boardContainer}>
        <GameBoard state={state} onRespawnComplete={completeRespawn} />
      </View>

      <GameToolbar
        state={state}
        onHint={handleHint}
        onUndo={handleUndo}
        onRefresh={() => refresh(difficulty)}
      />

      <View style={styles.padContainer}>
        <DirectionPad onPress={handleMove} />
      </View>

      <PauseMenu
        visible={paused}
        onResume={() => setPaused(false)}
        onRestart={() => {
          setPaused(false);
          restart();
        }}
        onHome={() => {
          setPaused(false);
          onHome();
        }}
      />

      <ClearModal
        visible={state.status === 'cleared'}
        state={state}
        isNewRecord={isNewRecord}
        onNext={() => {
          setIsNewRecord(false);
          nextStage();
        }}
        onHome={() => {
          setIsNewRecord(false);
          onHome();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  boardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  padContainer: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 8,
  },
});
