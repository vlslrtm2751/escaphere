import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type Props = TouchableOpacityProps & {
  children: React.ReactNode;
  size?: number;
  style?: ViewStyle;
};

export function IconButton({ children, size = 44, style, ...props }: Props) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surface },
        style,
      ]}
      activeOpacity={0.7}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
