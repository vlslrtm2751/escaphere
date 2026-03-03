import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { GameState } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../common/Badge';

type Props = {
  visible: boolean;
  state: GameState;
  isNewRecord: boolean;
  onNext: () => void;
  onHome: () => void;
};

export function ClearModal({ visible, state, isNewRecord, onNext, onHome }: Props) {
  const { theme } = useTheme();

  const optimalMoves = state.hint.solutionPath.length;
  const isPerfect = state.hint.usedCount === 0;
  const isOptimal = state.moveCount === optimalMoves;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={[styles.title, { color: theme.text }]}>클리어!</Text>

          {isNewRecord && (
            <Badge label="🏆 최고기록 갱신!" color={theme.exit} style={styles.badge} />
          )}

          <View style={[styles.stats, { backgroundColor: theme.bg }]}>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.subText }]}>내 이동수</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{state.moveCount}회</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.subText }]}>최적 이동수</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{optimalMoves}회</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: theme.subText }]}>힌트 사용</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{state.hint.usedCount}회</Text>
            </View>
          </View>

          {isPerfect && (
            <Badge label="✨ PERFECT" color={theme.player} style={styles.badge} />
          )}

          {isOptimal && !isPerfect && (
            <Badge label="⚡ 최적 경로" color={theme.exit} style={styles.badge} />
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.player }]}
              onPress={onNext}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: theme.bg }]}>다음 스테이지</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.dpad }]}
              onPress={onHome}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    width: 320,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  badge: {
    marginVertical: 4,
  },
  stats: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttons: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
