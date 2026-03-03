import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Difficulty, ClearRecord, StreakData } from '../types/game';
import { useTheme } from '../context/ThemeContext';
import { BgmToggleButton } from '../components/ui/BgmToggleButton';
import { ThemeToggleButton } from '../components/ui/ThemeToggleButton';
import { Badge } from '../components/common/Badge';
import { loadRecords, loadStreak } from '../storage/asyncStorage';
import { APP_VERSION } from '../constants/version';

type Props = {
  selectedDifficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onStart: () => void;
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
};

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export function HomeScreen({ selectedDifficulty, onDifficultyChange, onStart }: Props) {
  const { theme } = useTheme();
  const [records, setRecords] = useState<ClearRecord[]>([]);
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, bestStreak: 0 });

  useEffect(() => {
    loadRecords().then(setRecords);
    loadStreak().then(setStreak);
  }, []);

  const getRecord = (diff: Difficulty) => records.find(r => r.difficulty === diff);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* TopBar */}
      <View style={styles.topBar}>
        <BgmToggleButton />
        <View style={{ flex: 1 }} />
        <Text style={[styles.version, { color: theme.subText }]}>{APP_VERSION}</Text>
        <ThemeToggleButton />
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: theme.player }]}>Escaphere</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>장애물을 피해 탈출하라</Text>
      </View>

      {/* Difficulty Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subText }]}>난이도 선택</Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map(diff => (
            <TouchableOpacity
              key={diff}
              style={[
                styles.diffBtn,
                {
                  backgroundColor:
                    selectedDifficulty === diff ? theme.player : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => onDifficultyChange(diff)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.diffText,
                  {
                    color: selectedDifficulty === diff ? theme.bg : theme.text,
                  },
                ]}
              >
                {DIFFICULTY_LABELS[diff]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Best Records */}
      <View style={[styles.recordBoard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.subText }]}>최고 기록</Text>
        {DIFFICULTIES.map(diff => {
          const rec = getRecord(diff);
          return (
            <View key={diff} style={styles.recordRow}>
              <Text style={[styles.recordLabel, { color: theme.text }]}>
                {DIFFICULTY_LABELS[diff]}
              </Text>
              <Text style={[styles.recordValue, { color: rec ? theme.player : theme.subText }]}>
                {rec ? `${rec.bestMoveCount}회` : '-'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: theme.player }]}
        onPress={() => onStart()}
        activeOpacity={0.8}
      >
        <Text style={[styles.startText, { color: theme.bg }]}>시작하기</Text>
      </TouchableOpacity>

      {/* Streak Badge */}
      {streak.currentStreak > 0 && (
        <View style={styles.streakContainer}>
          <Badge
            label={`🔥 ${streak.currentStreak}연속 힌트없이 클리어`}
            color={theme.exit}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  version: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  diffText: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordBoard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLabel: {
    fontSize: 14,
  },
  recordValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  startBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  startText: {
    fontSize: 20,
    fontWeight: '800',
  },
  streakContainer: {
    alignItems: 'center',
  },
});
