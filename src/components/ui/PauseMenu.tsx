import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
};

export function PauseMenu({ visible, onResume, onRestart, onHome }: Props) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.menu, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>일시정지</Text>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.player }]}
            onPress={onResume}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: theme.bg }]}>계속하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.dpad }]}
            onPress={onRestart}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>다시하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.dpad }]}
            onPress={onHome}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>홈으로</Text>
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
  menu: {
    width: 280,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
