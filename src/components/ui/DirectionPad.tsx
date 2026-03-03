import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Direction } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  onPress: (direction: Direction) => void;
};

export function DirectionPad({ onPress }: Props) {
  const { theme } = useTheme();

  const btnStyle = [styles.btn, { backgroundColor: theme.dpad }];
  const textStyle = [styles.btnText, { color: theme.text }];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('up')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>▲</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('left')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>◀</Text>
        </TouchableOpacity>

        <View style={[styles.center, { backgroundColor: 'transparent' }]} />

        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('right')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('down')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BTN_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: BTN_SIZE,
    height: BTN_SIZE,
  },
  btnText: {
    fontSize: 22,
  },
});
