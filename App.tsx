import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen, GameScreenHandle, SWIPE_MIN_DISTANCE } from './src/screens/GameScreen';
import { swipeDirection } from './src/logic/swipeDirection';
import { Difficulty } from './src/types/game';
import { DARK_THEME } from './src/constants/theme';

const MAX_WIDTH = 480;

function AppContent() {
  const { hydrated } = useSettings();
  const { mode, theme } = useTheme();
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const gameScreenRef = useRef<GameScreenHandle>(null);

  // On a phone wide enough that the centred column doesn't fill the screen
  // (a folded-open Galaxy Fold, say), these empty side margins would
  // otherwise just be dead space -- swiping them moves the ball exactly like
  // swiping the board itself. gameScreenRef is null whenever GameScreen
  // isn't mounted (the home screen), so a swipe out here while there is no
  // board simply does nothing. Built fresh per side rather than shared: a
  // single Gesture config object is only meant to back one mounted
  // GestureDetector at a time.
  const makeMarginGesture = () =>
    Gesture.Pan()
      .minDistance(SWIPE_MIN_DISTANCE)
      .onEnd((e, success) => {
        if (!success) return;
        gameScreenRef.current?.swipeMove(swipeDirection(e.translationX, e.translationY));
      });
  const leftMarginGesture = makeMarginGesture();
  const rightMarginGesture = makeMarginGesture();

  if (!hydrated) {
    // Before hydration we don't yet know the stored theme, so there is no
    // color to paint but the default -- this avoids a flash of the wrong
    // theme once settings load.
    return <View style={{ flex: 1, backgroundColor: DARK_THEME.bg }} />;
  }

  return (
    // The swipe-to-move gesture (GameScreen, and the margins below) needs a
    // GestureHandlerRootView somewhere above it in the tree -- putting it
    // here, at the real root, is the library's own recommendation, so any
    // future gesture anywhere in the app is covered too, not just this one.
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {/* testID goes on this outer View, not the one GestureDetector wraps --
          GestureDetector clones its child to attach its own handlers, and
          that clone does not carry an unrecognized prop like testID through
          to the rendered DOM node. */}
      <View testID="side-margin-left" style={styles.margin}>
        <GestureDetector gesture={leftMarginGesture}>
          <View style={styles.marginFill} />
        </GestureDetector>
      </View>
      <View style={styles.inner}>
        {screen === 'home' ? (
          <HomeScreen
            selectedDifficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onStart={() => setScreen('game')}
          />
        ) : (
          <GameScreen
            ref={gameScreenRef}
            difficulty={difficulty}
            onHome={() => setScreen('home')}
          />
        )}
      </View>
      <View testID="side-margin-right" style={styles.margin}>
        <GestureDetector gesture={rightMarginGesture}>
          <View style={styles.marginFill} />
        </GestureDetector>
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
    flexDirection: 'row',
  },
  // Absorbs whatever width the centred column (below) doesn't need, so on a
  // screen narrower than MAX_WIDTH both margins settle at 0 width instead of
  // squeezing the column -- see the gesture these carry, above.
  margin: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
  },
  marginFill: {
    flex: 1,
  },
  inner: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: MAX_WIDTH,
    maxWidth: MAX_WIDTH,
  },
});
