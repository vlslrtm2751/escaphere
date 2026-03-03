import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Direction, Position } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  pos: Position;
  cellSize: number;
  gridSize: number;
  respawnDir: Direction | null;
  onRespawnComplete: () => void;
};

const DIR_DELTA: Record<Direction, { x: number; y: number }> = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y:  1 },
  left:  { x: -1, y: 0 },
  right: { x:  1, y: 0 },
};

export function PlayerOrb({ pos, cellSize, gridSize, respawnDir, onRespawnComplete }: Props) {
  const { theme } = useTheme();
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  const orbSize = cellSize * 0.65;
  const offset  = (cellSize - orbSize) / 2;

  const animX = useSharedValue(pos.col * cellSize + offset);
  const animY = useSharedValue(pos.row * cellSize + offset);

  // Track whether the next pos update is a respawn (needs instant jump + pop-in)
  const justRespawnedRef = useRef(false);

  // ── Pulse (idle) ─────────────────────────────────────────────────────────────
  const startPulse = () => {
    scale.value = withRepeat(
      withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1, true
    );
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1, true
    );
  };

  useEffect(() => { startPulse(); }, []);

  // ── Normal movement animation ─────────────────────────────────────────────────
  useEffect(() => {
    const targetX = pos.col * cellSize + offset;
    const targetY = pos.row * cellSize + offset;

    if (justRespawnedRef.current) {
      justRespawnedRef.current = false;

      // Instant jump to center (invisible)
      animX.value = targetX;
      animY.value = targetY;

      // Pop-in: scale 0 → 1.4 → 1, opacity 0 → full
      scale.value = withSequence(
        withTiming(0,   { duration: 0 }),
        withTiming(1.4, { duration: 160, easing: Easing.out(Easing.back(2)) }),
        withTiming(1,   { duration: 160, easing: Easing.out(Easing.cubic) })
      );
      opacity.value = withTiming(1, { duration: 200 });

      // Restart idle pulse after pop-in finishes
      const t = setTimeout(startPulse, 350);
      return () => clearTimeout(t);
    }

    // Normal slide animation
    animX.value = withTiming(targetX, { duration: 180, easing: Easing.out(Easing.cubic) });
    animY.value = withTiming(targetY, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [pos.row, pos.col, cellSize]);

  // ── Fly-out animation (when ball leaves the grid) ─────────────────────────────
  useEffect(() => {
    if (respawnDir === null) return;

    const delta   = DIR_DELTA[respawnDir];
    const flyDist = cellSize * (gridSize + 1); // enough to clear the board

    // Slide off in the movement direction
    animX.value = withTiming(animX.value + delta.x * flyDist, {
      duration: 260,
      easing: Easing.in(Easing.cubic),
    });
    animY.value = withTiming(animY.value + delta.y * flyDist, {
      duration: 260,
      easing: Easing.in(Easing.cubic),
    });

    // Scale bursts then collapses, opacity fades
    scale.value   = withSequence(
      withTiming(1.6, { duration: 100 }),
      withTiming(0,   { duration: 180 })
    );
    opacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });

    // After animation: flag the next pos update as a respawn, then notify parent
    const t = setTimeout(() => {
      justRespawnedRef.current = true;
      onRespawnComplete();
    }, 300);

    return () => clearTimeout(t);
  }, [respawnDir]);

  // ─────────────────────────────────────────────────────────────────────────────
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    left: animX.value,
    top:  animY.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: orbSize,
          height: orbSize,
          borderRadius: orbSize / 2,
          shadowColor: theme.playerGlow,
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={[theme.player, theme.playerGlow]}
        style={[styles.gradient, { borderRadius: orbSize / 2 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    flex: 1,
  },
});
