import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameState } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  state: GameState;
  onHint: () => void;
  onUndo: () => void;
  onRefresh: () => void;
};

export function GameToolbar({ state, onHint, onUndo, onRefresh }: Props) {
  const { theme } = useTheme();

  const hintTotal = state.hint.steps.length;
  const hintRevealed = state.hint.revealedCount;
  const hintDisabled = hintRevealed >= hintTotal;
  const undoDisabled = state.undoRemaining <= 0 || state.undoStack.length === 0;

  return (
    <View style={[styles.toolbar, { backgroundColor: theme.surface }]}>
      <TouchableOpacity
        style={[styles.btn, { opacity: hintDisabled ? 0.4 : 1 }]}
        onPress={onHint}
        disabled={hintDisabled}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, { color: theme.hintArrow }]}>💡</Text>
        <Text style={[styles.label, { color: theme.text }]}>
          {hintDisabled ? `힌트 완료` : `힌트 ${hintRevealed}/${hintTotal}`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { opacity: undoDisabled ? 0.4 : 1 }]}
        onPress={onUndo}
        disabled={undoDisabled}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, { color: theme.player }]}>↩</Text>
        <Text style={[styles.label, { color: theme.text }]}>
          되돌리기 ({state.undoRemaining})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onRefresh}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, { color: theme.subText }]}>🔄</Text>
        <Text style={[styles.label, { color: theme.text }]}>재생성</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  btn: {
    alignItems: 'center',
    padding: 8,
    minWidth: 80,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
  },
});
