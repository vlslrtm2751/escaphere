import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Difficulty, Direction, GameEventKind } from '../types/game';
import { useTheme } from '../context/ThemeContext';
import { useGameState } from '../hooks/useGameState';
import { useSfx } from '../hooks/useSfx';
import { useHaptic } from '../hooks/useHaptic';
import { SfxKey } from '../constants/sounds';
import { GameBoard } from '../components/game/GameBoard';
import { GameHeader } from '../components/ui/GameHeader';
import { GameToolbar } from '../components/ui/GameToolbar';
import { DirectionPad } from '../components/ui/DirectionPad';
import { PauseMenu } from '../components/ui/PauseMenu';
import { SettingsModal } from '../components/ui/SettingsModal';
import { ClearModal } from '../components/ui/ClearModal';
import { incrementOptimalClears, saveStreak, loadStreak } from '../storage/asyncStorage';
import { isOptimalClear } from '../logic/hintLogic';

type Props = {
  difficulty: Difficulty;
  onHome: () => void;
};

// Haptic trigger named by key, not called directly, so this table reads as a
// flat list of "event -> sound, haptic" rather than a pile of inline calls.
// Record<GameEventKind, ...> makes the mapping exhaustive at the type level:
// add a member to GameEventKind without a row here and this constant stops
// compiling.
type HapticKey = keyof ReturnType<typeof useHaptic>;

const FEEDBACK: Record<GameEventKind, { sound: SfxKey | null; haptic: HapticKey | null }> = {
  none:    { sound: null,    haptic: null },
  moved:   { sound: 'move',  haptic: 'triggerMove' },
  blocked: { sound: 'wall',  haptic: 'triggerWall' },
  out:     { sound: 'out',   haptic: 'triggerOut' },
  exit:    { sound: 'clear', haptic: 'triggerClear' },
  undo:    { sound: 'undo',  haptic: null },
  hint:    { sound: 'hint',  haptic: null },
};

export function GameScreen({ difficulty, onHome }: Props) {
  const { theme } = useTheme();
  const { state, move, undo, hint, refresh, nextStage, restart, completeRespawn } = useGameState(difficulty);
  const { playSfx } = useSfx();
  const haptic = useHaptic();
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Event -> feedback (sound + haptic). Keyed on seq alone, not kind and not
  // the event object: a second consecutive 'blocked' move has the same kind
  // as the first but a higher seq, and it must still be felt.
  useEffect(() => {
    if (state.lastEvent.seq === 0) return; // fresh board — nothing happened yet
    const feedback = FEEDBACK[state.lastEvent.kind];
    if (feedback.sound) playSfx(feedback.sound);
    if (feedback.haptic) haptic[feedback.haptic]();
  }, [state.lastEvent.seq]);

  // Handle clear record-keeping. Feedback for 'cleared' is handled above via
  // the 'exit' event — this effect only persists the result.
  useEffect(() => {
    if (state.status === 'cleared') {
      handleClear();
    }
  }, [state.status]);

  const handleClear = async () => {
    // Counts toward the difficulty's optimal-clear tally whenever this run
    // matched the board's own optimal length — not a "best" comparison, since
    // boards of the same difficulty don't all draw the same optimal length.
    if (isOptimalClear(state)) {
      await incrementOptimalClears(state.difficulty);
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
    if (state.status !== 'playing' || paused || settingsOpen) return;
    move(direction);
  }, [state.status, move, paused, settingsOpen]);

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
  }, [hint]);

  const handleUndo = useCallback(() => {
    if (state.undoRemaining <= 0 || state.undoStack.length === 0) return;
    undo();
  }, [state, undo]);

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

      <View testID="pad-area" style={styles.padContainer}>
        <DirectionPad onPress={handleMove} />
      </View>

      <PauseMenu
        visible={paused}
        onResume={() => setPaused(false)}
        onRestart={() => {
          setPaused(false);
          restart();
        }}
        onSettings={() => setSettingsOpen(true)}
        onHome={() => {
          setPaused(false);
          onHome();
        }}
      />

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ClearModal
        visible={state.status === 'cleared'}
        state={state}
        onNext={nextStage}
        onHome={onHome}
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
