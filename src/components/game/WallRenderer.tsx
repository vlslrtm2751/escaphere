import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CellWalls } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  walls: CellWalls;
  cellSize: number;
};

const WALL_THICKNESS = 3;

export function WallRenderer({ walls, cellSize }: Props) {
  const { theme } = useTheme();

  return (
    <>
      {walls.top && (
        <View
          style={[
            styles.wall,
            {
              top: 0,
              left: 0,
              right: 0,
              height: WALL_THICKNESS,
              backgroundColor: theme.wall,
            },
          ]}
        />
      )}
      {walls.right && (
        <View
          style={[
            styles.wall,
            {
              top: 0,
              right: 0,
              bottom: 0,
              width: WALL_THICKNESS,
              backgroundColor: theme.wall,
            },
          ]}
        />
      )}
      {walls.bottom && (
        <View
          style={[
            styles.wall,
            {
              bottom: 0,
              left: 0,
              right: 0,
              height: WALL_THICKNESS,
              backgroundColor: theme.wall,
            },
          ]}
        />
      )}
      {walls.left && (
        <View
          style={[
            styles.wall,
            {
              top: 0,
              left: 0,
              bottom: 0,
              width: WALL_THICKNESS,
              backgroundColor: theme.wall,
            },
          ]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wall: {
    position: 'absolute',
    zIndex: 2,
  },
});
