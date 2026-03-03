import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  label: string;
  color?: string;
  style?: ViewStyle;
};

export function Badge({ label, color, style }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: color ?? theme.player }, style]}>
      <Text style={[styles.label, { color: theme.bg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
