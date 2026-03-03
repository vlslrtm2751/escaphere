import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Position } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  pos: Position;
  cellSize: number;
};

export function PlayerOrb({ pos, cellSize }: Props) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const orbSize = cellSize * 0.65;
  const offset = (cellSize - orbSize) / 2;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: orbSize,
          height: orbSize,
          borderRadius: orbSize / 2,
          top: pos.row * cellSize + offset,
          left: pos.col * cellSize + offset,
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
