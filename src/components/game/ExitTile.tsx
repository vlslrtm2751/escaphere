import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Position } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';

type Props = {
  pos: Position;
  cellSize: number;
};

export function ExitTile({ pos, cellSize }: Props) {
  const { theme } = useTheme();
  const { settings } = useSettings();

  return (
    <View
      style={[
        styles.container,
        {
          width: cellSize,
          height: cellSize,
          top: pos.row * cellSize,
          left: pos.col * cellSize,
        },
      ]}
    >
      <LinearGradient
        colors={[theme.exitGlow, theme.exit]}
        style={styles.gradient}
      >
        {settings.colorBlindMode && (
          <Text style={styles.star}>★</Text>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  star: {
    fontSize: 20,
    color: '#fff',
  },
});
