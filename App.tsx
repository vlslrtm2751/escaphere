import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { Difficulty } from './src/types/game';

const MAX_WIDTH = 480;

function AppContent() {
  const { mode, theme } = useTheme();
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.inner}>
        {screen === 'home' ? (
          <HomeScreen
            selectedDifficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onStart={() => setScreen('game')}
          />
        ) : (
          <GameScreen difficulty={difficulty} onHome={() => setScreen('home')} />
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
});
