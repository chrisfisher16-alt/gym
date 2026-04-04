import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type Colors } from './colors';
import { typography, type Typography } from './typography';
import { spacing, radius, type Spacing, type Radius } from './spacing';
import { useThemeStore } from '../stores/theme-store';

export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: Radius;
  dark: boolean;
}

export function useTheme(): Theme {
  const colorMode = useThemeStore((s) => s.colorMode);
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme);
  const systemScheme = useColorScheme();

  // Determine effective dark/light:
  // - 'dark' or 'light' → use directly
  // - 'auto' → prefer store's resolvedScheme, fall back to system hook
  const dark =
    colorMode === 'dark'
      ? true
      : colorMode === 'light'
        ? false
        : resolvedScheme === 'dark' || systemScheme === 'dark';

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
