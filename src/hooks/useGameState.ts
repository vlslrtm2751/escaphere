import { useState, useCallback } from 'react';
import { Difficulty, Direction, GameState } from '../types/game';
import { generateMap } from '../logic/mapGenerator';
import { resolveMove, resolveRespawn } from '../logic/resolveMove';
import { resolveHint } from '../logic/hintLogic';
import { applyUndo } from '../logic/undoLogic';

export function useGameState(initialDifficulty: Difficulty = 'normal') {
  const [state, setState] = useState<GameState>(() =>
    generateMap(initialDifficulty)
  );

  // Every rule below lives in src/logic/, which has no React in it and runs
  // under plain node — that is what makes it testable. This hook only holds
  // the state and hands each press to the matching pure function.
  const move = useCallback((direction: Direction) => {
    setState(prev => resolveMove(prev, direction));
  }, []);

  /** Called by PlayerOrb after its fly-out animation finishes. */
  const completeRespawn = useCallback(() => {
    setState(resolveRespawn);
  }, []);

  const undo = useCallback(() => {
    setState(applyUndo);
  }, []);

  const hint = useCallback(() => {
    setState(resolveHint);
  }, []);

  // generateMap is built outside the updater on purpose: React may call an
  // updater more than once, which would generate the map twice and — for an
  // unseeded call — hand back a different board each time.
  const refresh = useCallback((difficulty?: Difficulty) => {
    setState(generateMap(difficulty ?? state.difficulty));
  }, [state.difficulty]);

  const nextStage = useCallback(() => {
    setState(generateMap(state.difficulty, undefined, state.stageNumber + 1));
  }, [state.difficulty, state.stageNumber]);

  const restart = useCallback(() => {
    setState(generateMap(state.difficulty, state.stageSeed, state.stageNumber));
  }, [state.difficulty, state.stageSeed, state.stageNumber]);

  return { state, move, undo, hint, refresh, nextStage, restart, completeRespawn };
}
