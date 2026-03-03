import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HintStep, Position } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';

const DIR_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

type Props = {
  steps: HintStep[];
  revealedCount: number;
  cellSize: number;
};

function posKey(p: Position) {
  return `${p.row},${p.col}`;
}

export function HintPathOverlay({ steps, revealedCount, cellSize }: Props) {
  const { theme } = useTheme();
  const { settings } = useSettings();

  if (revealedCount === 0) return null;

  const revealed = steps.slice(0, revealedCount);

  return (
    <>
      {revealed.map((step, si) =>
        step.pathCells.map((cell, ci) => (
          <View
            key={`${si}-${ci}`}
            style={[
              styles.cell,
              {
                width: cellSize,
                height: cellSize,
                top: cell.row * cellSize,
                left: cell.col * cellSize,
                borderColor: settings.colorBlindMode ? theme.hintArrow : 'transparent',
                borderWidth: settings.colorBlindMode ? 2 : 0,
                borderStyle: settings.colorBlindMode ? 'dashed' : 'solid',
              },
            ]}
          >
            {ci === 0 && (
              <Text style={[styles.arrow, { color: theme.hintArrow }]}>
                {DIR_ARROW[step.direction]}
              </Text>
            )}
          </View>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(85, 153, 255, 0.15)',
  },
  arrow: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.5,
  },
});
