import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';

export function BgmToggleButton() {
  const { theme } = useTheme();
  const { settings, updateSettings } = useSettings();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.surface }]}
      onPress={() => updateSettings({ bgmOn: !settings.bgmOn })}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, { color: settings.bgmOn ? theme.player : theme.subText }]}>
        {settings.bgmOn ? '♪' : '♪̶'}
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
