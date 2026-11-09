import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';

export function SfxToggleButton() {
  const { theme } = useTheme();
  const { settings, updateSettings } = useSettings();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.surface }]}
      onPress={() => updateSettings({ sfxOn: !settings.sfxOn })}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, { color: settings.sfxOn ? theme.player : theme.subText }]}>
        {settings.sfxOn ? '🔊' : '🔇'}
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
    fontSize: 20,
  },
});
