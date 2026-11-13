import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { Difficulty } from './src/types/game';
import { DARK_THEME } from './src/constants/theme';

const MAX_WIDTH = 480;

function AppContent() {
  const { hydrated } = useSettings();
  const { mode, theme } = useTheme();
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  if (!hydrated) {
    // Before hydration we don't yet know the stored theme, so there is no
    // color to paint but the default -- this avoids a flash of the wrong
    // theme once settings load.
    return <View style={{ flex: 1, backgroundColor: DARK_THEME.bg }} />;
  }

  return (
    // The swipe-to-move gesture (GameScreen) needs a GestureHandlerRootView
    // somewhere above it in the tree -- putting it here, at the real root,
    // is the library's own recommendation, so any future gesture anywhere
    // in the app is covered too, not just this one.
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.bg }]}>
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
    </GestureHandlerRootView>
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
