import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  LayoutChangeEvent,
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

  // The board sizes itself to the space this screen gives it, rather than to the
  // window: the header, toolbar and pad take a fixed share of the height, and a
  // board sized from width alone overflowed onto them on short screens.
  // Measuring also keeps it correct through rotation and window resizes.
  const [boardSpace, setBoardSpace] = useState({ width: 0, height: 0 });
  const measureBoardSpace = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoardSpace(prev =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    );
  }, []);

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
        {/* onLayout reports the padded box, so the measured element is this
            inner one: its size is exactly the room the board may fill. */}
        <View style={styles.boardMeasure} onLayout={measureBoardSpace}>
          {boardSpace.width > 0 && (
            <GameBoard
              state={state}
              onRespawnComplete={completeRespawn}
              available={boardSpace}
            />
          )}
        </View>
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
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  boardMeasure: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    // No overflow:hidden here — wall bars sit centred on the outer boundary and
    // overhang it by half their thickness, and clipping would shave them off.
  },
  padContainer: {
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 8,
  },
});
