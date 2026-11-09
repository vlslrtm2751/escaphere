import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { Theme } from '../../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ToggleRowProps = {
  label: string;
  value: boolean;
  onToggle: () => void;
  theme: Theme;
};

// A small pressable pill rather than React Native's built-in Switch: every
// other control on this screen (SfxToggleButton, ThemeToggleButton, the menu
// buttons) is a flat theme-colored shape, not a native OS control, and a
// Switch would look like a different app bolted onto this one.
function ToggleRow({ label, value, onToggle, theme }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.track, { backgroundColor: value ? theme.player : theme.dpad }]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.knob,
            { backgroundColor: theme.surface },
            value ? styles.knobOn : styles.knobOff,
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

export function SettingsModal({ visible, onClose }: Props) {
  const { theme, mode, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View testID="settings-modal" style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>설정</Text>

          <ToggleRow
            label="효과음"
            value={settings.sfxOn}
            onToggle={() => updateSettings({ sfxOn: !settings.sfxOn })}
            theme={theme}
          />

          {/* expo-haptics does nothing on web -- a toggle that has no effect
              is exactly the kind of dead control this screen exists to avoid,
              so it is hidden here rather than merely disabled. */}
          {Platform.OS !== 'web' && (
            <ToggleRow
              label="진동"
              value={settings.hapticOn}
              onToggle={() => updateSettings({ hapticOn: !settings.hapticOn })}
              theme={theme}
            />
          )}

          <ToggleRow
            label="색약 모드"
            value={settings.colorBlindMode}
            onToggle={() => updateSettings({ colorBlindMode: !settings.colorBlindMode })}
            theme={theme}
          />

          <ToggleRow label="밝은 테마" value={mode === 'light'} onToggle={toggleTheme} theme={theme} />

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.dpad }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeText, { color: theme.text }]}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 280,
    borderRadius: 20,
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
  knobOff: {
    alignSelf: 'flex-start',
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
