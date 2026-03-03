import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, ClearRecord, Difficulty, StreakData } from '../types/game';

const KEYS = {
  RECORDS: 'escaphere_records',
  SETTINGS: 'escaphere_settings',
  STREAK: 'escaphere_streak',
};

export async function saveRecord(record: ClearRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECORDS);
    const records: ClearRecord[] = raw ? JSON.parse(raw) : [];
    const idx = records.findIndex(r => r.difficulty === record.difficulty);
    if (idx >= 0) {
      if (record.bestMoveCount < records[idx].bestMoveCount) {
        records[idx] = record;
      }
    } else {
      records.push(record);
    }
    await AsyncStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  } catch {}
}

export async function loadRecords(): Promise<ClearRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECORDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getBestRecord(difficulty: Difficulty): Promise<ClearRecord | null> {
  const records = await loadRecords();
  return records.find(r => r.difficulty === difficulty) ?? null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch {}
}

export async function loadSettings(): Promise<AppSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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
