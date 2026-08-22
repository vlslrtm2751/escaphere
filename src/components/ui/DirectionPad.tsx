import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Direction } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  onPress: (direction: Direction) => void;
};

export function DirectionPad({ onPress }: Props) {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();

  // The pad used to be a fixed 220px tall, a third of a short phone's screen,
  // leaving the board too little room. Scale it with the screen instead, with a
  // floor that keeps the buttons comfortably tappable.
  const size = Math.round(Math.min(60, Math.max(44, height * 0.072)));
  const gap = Math.max(4, Math.round(size * 0.1));

  const btnStyle = [styles.btn, { width: size, height: size, backgroundColor: theme.dpad }];
  const textStyle = [styles.btnText, { color: theme.text, fontSize: Math.round(size * 0.37) }];

  return (
    <View style={[styles.container, { gap }]}>
      <View style={[styles.row, { gap }]}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('up')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>▲</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.row, { gap }]}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('left')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>◀</Text>
        </TouchableOpacity>

        <View style={{ width: size, height: size }} />

        <TouchableOpacity
          style={btnStyle}
          onPress={() => onPress('right')}
          activeOpacity={0.6}
        >
          <Text style={textStyle}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.row, { gap }]}>
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {},
});
