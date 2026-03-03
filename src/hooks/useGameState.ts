import { useState, useCallback } from 'react';
import { Difficulty, Direction, GameState } from '../types/game';
import { generateMap } from '../logic/mapGenerator';
import { simulateMove } from '../logic/moveLogic';
import { revealNextHint } from '../logic/hintLogic';
import { pushUndo, applyUndo } from '../logic/undoLogic';

export function useGameState(initialDifficulty: Difficulty = 'normal') {
  const [state, setState] = useState<GameState>(() =>
    generateMap(initialDifficulty)
  );

  const move = useCallback((direction: Direction) => {
    setState(prev => {
      if (prev.status !== 'playing') return prev;

      const withUndo = pushUndo(prev);
      const { landPos, result } = simulateMove(
        prev.grid,
        prev.playerPos,
        direction,
        prev.gridSize,
        prev.exitPos
      );

      if (result === 'out') {
        return { ...withUndo, playerPos: landPos, status: 'gameover', moveCount: prev.moveCount + 1 };
      }

      if (result === 'exit') {
        return { ...withUndo, playerPos: landPos, status: 'cleared', moveCount: prev.moveCount + 1 };
      }

      if (landPos.row === prev.playerPos.row && landPos.col === prev.playerPos.col) {
        // no movement (wall blocking immediately) - don't count move
        return prev;
      }

      return { ...withUndo, playerPos: landPos, moveCount: prev.moveCount + 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => applyUndo(prev));
  }, []);

  const hint = useCallback(() => {
    setState(prev => ({
      ...prev,
      hint: revealNextHint(prev.hint),
    }));
  }, []);

  const refresh = useCallback((difficulty?: Difficulty) => {
    setState(prev => generateMap(difficulty ?? prev.difficulty));
  }, []);

  const nextStage = useCallback(() => {
    setState(prev => generateMap(prev.difficulty, undefined, prev.stageNumber + 1));
  }, []);

  const restart = useCallback(() => {
    setState(prev => generateMap(prev.difficulty, prev.stageSeed, prev.stageNumber));
  }, []);

  return { state, move, undo, hint, refresh, nextStage, restart };
}
