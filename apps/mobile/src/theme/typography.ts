import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Display
  displayLarge: {
    fontFamily,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontFamily,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },

  // Headings
  h1: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h3: {
    fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },

  // Body
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },

  // Labels
  labelLarge: {
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  label: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  labelSmall: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },

  // Caption
  caption: {
    fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
  },
} as const;

export type Typography = typeof typography;
