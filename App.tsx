import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { Difficulty } from './src/types/game';

function AppContent() {
  const { mode } = useTheme();
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const handleStart = (diff: Difficulty) => {
    setDifficulty(diff);
    setScreen('game');
  };

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {screen === 'home' ? (
        <HomeScreen onStart={handleStart} />
      ) : (
        <GameScreen difficulty={difficulty} onHome={() => setScreen('home')} />
      )}
    </>
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
