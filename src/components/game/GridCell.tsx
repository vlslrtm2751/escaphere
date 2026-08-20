import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  cellSize: number;
  isHinted: boolean;
};

/**
 * Background and grid line for one cell. Walls are NOT drawn here — they belong
 * to the boundary between two cells, so WallRenderer draws them as one collapsed
 * layer over the whole board.
 */
export function GridCell({ cellSize, isHinted }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor: isHinted ? theme.cellHint : theme.cell,
          borderColor: theme.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  cell: {
    borderWidth: 0.5,
  },
});
