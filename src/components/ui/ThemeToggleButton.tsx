import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggleButton() {
  const { theme, mode, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.surface }]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, { color: theme.text }]}>
        {mode === 'dark' ? '☀️' : '🌙'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
});
