import { useCallback } from 'react';
import { Direction, Difficulty } from '../types/game';
import { useGameState } from './useGameState';
import { useSfx } from './useSfx';
import { useHaptic } from './useHaptic';

export function useGameActions(initialDifficulty: Difficulty = 'normal') {
  const game = useGameState(initialDifficulty);
  const { playSfx } = useSfx();
  const haptic = useHaptic();

  const move = useCallback((direction: Direction) => {
    game.move(direction);
    playSfx('move');
    haptic.triggerMove();
  }, [game, playSfx, haptic]);

  const undo = useCallback(() => {
    if (game.state.undoRemaining <= 0 || game.state.undoStack.length === 0) return;
    game.undo();
    playSfx('undo');
  }, [game, playSfx]);

  const hint = useCallback(() => {
    game.hint();
    playSfx('hint');
  }, [game, playSfx]);

  const refresh = useCallback((difficulty?: Difficulty) => {
    game.refresh(difficulty);
  }, [game]);

  return {
    state: game.state,
    move,
    undo,
    hint,
    refresh,
    nextStage: game.nextStage,
    restart: game.restart,
  };
}
