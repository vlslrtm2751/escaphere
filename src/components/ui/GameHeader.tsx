import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameState } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  state: GameState;
  onPause: () => void;
};

export function GameHeader({ state, onPause }: Props) {
  const { theme } = useTheme();

  const optimalMoves = state.hint.solutionPath.length;

  return (
    <View style={[styles.header, { backgroundColor: theme.surface }]}>
      <TouchableOpacity onPress={onPause} style={styles.pauseBtn} activeOpacity={0.7}>
        <Text style={[styles.pauseIcon, { color: theme.text }]}>⏸</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={[styles.moveText, { color: theme.text }]}>
          이동: {state.moveCount}회
        </Text>
        <Text style={[styles.optimalText, { color: theme.subText }]}>
          최적: {optimalMoves}회
        </Text>
      </View>

      <View style={styles.stageInfo}>
        <Text style={[styles.stageText, { color: theme.subText }]}>
          스테이지 {state.stageNumber}
        </Text>
        <Text style={[styles.seedText, { color: theme.subText }]} numberOfLines={1}>
          {state.stageSeed.slice(0, 8)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pauseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    fontSize: 22,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  moveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  optimalText: {
    fontSize: 12,
    marginTop: 2,
  },
  stageInfo: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  stageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  seedText: {
    fontSize: 10,
    marginTop: 2,
  },
});
