import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, ClearRecord, Difficulty, StreakData } from '../types/game';
import { mergeSettings } from '../logic/settings';

const KEYS = {
  RECORDS: 'escaphere_records',
  SETTINGS: 'escaphere_settings',
  STREAK: 'escaphere_streak',
};

// Coerces whatever was stored into the current ClearRecord shape. Needed
// because the site has been live under the old shape ({ bestMoveCount }) —
// without this, an old entry's missing optimalClearCount renders as
// "undefined회" instead of either a real count or the empty "-" state.
function sanitizeRecord(r: unknown): ClearRecord | null {
  if (typeof r !== 'object' || r === null) return null;
  const { difficulty, optimalClearCount, lastUpdated } = r as Record<string, unknown>;
  if (typeof difficulty !== 'string') return null;
  return {
    difficulty: difficulty as Difficulty,
    optimalClearCount: typeof optimalClearCount === 'number' ? optimalClearCount : 0,
    lastUpdated: typeof lastUpdated === 'string' ? lastUpdated : new Date(0).toISOString(),
  };
}

export async function loadRecords(): Promise<ClearRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECORDS);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeRecord).filter((r): r is ClearRecord => r !== null);
  } catch {
    return [];
  }
}

// Called on every clear whose moveCount matched the board's optimal length.
// Unconditional +1, not a comparison — unlike a "best" move count, this
// stays meaningful across boards of the same difficulty with different
// optimal lengths (see ClearRecord).
export async function incrementOptimalClears(difficulty: Difficulty): Promise<void> {
  const records = await loadRecords();
  const idx = records.findIndex(r => r.difficulty === difficulty);
  if (idx >= 0) {
    records[idx] = {
      ...records[idx],
      optimalClearCount: records[idx].optimalClearCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  } else {
    records.push({ difficulty, optimalClearCount: 1, lastUpdated: new Date().toISOString() });
  }
  try {
    await AsyncStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  } catch {}
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch {}
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return mergeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return mergeSettings(null);
  }
}

export async function saveStreak(streak: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
  } catch {}
}

export async function loadStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    return raw ? JSON.parse(raw) : { currentStreak: 0, bestStreak: 0 };
  } catch {
    return { currentStreak: 0, bestStreak: 0 };
  }
}
