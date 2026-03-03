import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GameState } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { GridCell } from './GridCell';
import { ExitTile } from './ExitTile';
import { PlayerOrb } from './PlayerOrb';
import { HintPathOverlay } from './HintPathOverlay';

type Props = {
  state: GameState;
};

const PADDING = 8;

export function GameBoard({ state }: Props) {
  const { theme } = useTheme();
  const { width } = Dimensions.get('window');
  const boardSize = Math.min(width - PADDING * 2, 400);
  const cellSize = Math.floor(boardSize / state.gridSize);

  // Build hinted cells set
  const hintedCells = new Set<string>();
  if (state.hint.revealedCount > 0) {
    state.hint.steps.slice(0, state.hint.revealedCount).forEach(step => {
      step.pathCells.forEach(p => hintedCells.add(`${p.row},${p.col}`));
    });
  }

  return (
    <View
      style={[
        styles.board,
        {
          width: cellSize * state.gridSize,
          height: cellSize * state.gridSize,
          backgroundColor: theme.bg,
        },
      ]}
    >
      {state.grid.map((row, ri) =>
        row.map((cell, ci) => (
          <GridCell
            key={`${ri}-${ci}`}
            walls={cell}
            cellSize={cellSize}
            isHinted={hintedCells.has(`${ri},${ci}`)}
          />
        ))
      )}
      <View style={styles.overlay} pointerEvents="none">
        <ExitTile pos={state.exitPos} cellSize={cellSize} />
        <HintPathOverlay
          steps={state.hint.steps}
          revealedCount={state.hint.revealedCount}
          cellSize={cellSize}
        />
        <PlayerOrb pos={state.playerPos} cellSize={cellSize} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
