import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type Colors } from './colors';
import { typography, type Typography } from './typography';
import { spacing, radius, type Spacing, type Radius } from './spacing';

export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: Radius;
  dark: boolean;
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';

  return {
    colors: dark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    dark,
  };
}

export { lightColors, darkColors, typography, spacing, radius };
export type { Colors, Typography, Spacing, Radius };
