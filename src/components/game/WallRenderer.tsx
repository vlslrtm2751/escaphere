import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { CellWalls } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  grid: CellWalls[][];
  gridSize: number;
  cellSize: number;
};

const WALL_THICKNESS = 3;

/**
 * Draws every walled boundary exactly once, centred on the grid line.
 *
 * A wall lives on the boundary *between* two cells and either side may carry
 * the flag — the generator marks only one, but two neighbouring wall pairs can
 * still claim the same edge from opposite sides. Drawing per cell put a bar
 * inside each one, so a shared edge came out as two parallel lines (`a||b`).
 * Walking boundaries instead collapses them into a single line, the way
 * `border-collapse` does for table cells.
 *
 * Segments overhang by half the thickness at both ends so the two arms of an
 * L-shaped wall pair meet without a notch at the corner.
 */
export function WallRenderer({ grid, gridSize, cellSize }: Props) {
  const { theme } = useTheme();

  const half = WALL_THICKNESS / 2;
  const segments: React.ReactNode[] = [];

  const push = (key: string, style: ViewStyle) => {
    segments.push(
      <View key={key} style={[styles.wall, style, { backgroundColor: theme.wall }]} />
    );
  };

  // Vertical boundaries — the line at x = c * cellSize, for c in 0..gridSize.
  // c === 0 and c === gridSize are the board's outer left/right edges, where a
  // wall is what stops the ball from leaving the grid.
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c <= gridSize; c++) {
      const west = c > 0 ? grid[r][c - 1].right : false;
      const east = c < gridSize ? grid[r][c].left : false;
      if (!west && !east) continue;
      push(`v-${r}-${c}`, {
        left: c * cellSize - half,
        top: r * cellSize - half,
        width: WALL_THICKNESS,
        height: cellSize + WALL_THICKNESS,
      });
    }
  }

  // Horizontal boundaries — the line at y = r * cellSize, for r in 0..gridSize.
  for (let c = 0; c < gridSize; c++) {
    for (let r = 0; r <= gridSize; r++) {
      const north = r > 0 ? grid[r - 1][c].bottom : false;
      const south = r < gridSize ? grid[r][c].top : false;
      if (!north && !south) continue;
      push(`h-${r}-${c}`, {
        left: c * cellSize - half,
        top: r * cellSize - half,
        width: cellSize + WALL_THICKNESS,
        height: WALL_THICKNESS,
      });
    }
  }

  return <>{segments}</>;
}

const styles = StyleSheet.create({
  wall: {
    position: 'absolute',
    // above the hint path (3), below the player orb (10)
    zIndex: 5,
    borderRadius: 1,
  },
});
