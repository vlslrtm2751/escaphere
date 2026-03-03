import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CellWalls } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { WallRenderer } from './WallRenderer';

type Props = {
  walls: CellWalls;
  cellSize: number;
  isHinted: boolean;
};

export function GridCell({ walls, cellSize, isHinted }: Props) {
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
    >
      <WallRenderer walls={walls} cellSize={cellSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    borderWidth: 0.5,
    position: 'relative',
    overflow: 'hidden',
  },
});
