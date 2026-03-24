import { Platform } from 'react-native';
import { moderateScale } from './scale';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Display
  displayLarge: {
    fontFamily,
    fontSize: moderateScale(32),
    lineHeight: moderateScale(40),
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontFamily,
    fontSize: moderateScale(28),
    lineHeight: moderateScale(36),
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },

  // Headings
  h1: {
    fontFamily,
    fontSize: moderateScale(24),
    lineHeight: moderateScale(32),
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily,
    fontSize: moderateScale(20),
    lineHeight: moderateScale(28),
    fontWeight: '600' as const,
  },
  h3: {
    fontFamily,
    fontSize: moderateScale(18),
    lineHeight: moderateScale(24),
    fontWeight: '600' as const,
  },

  // Body
  bodyLarge: {
    fontFamily,
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    fontWeight: '400' as const,
  },
  body: {
    fontFamily,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontFamily,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    fontWeight: '400' as const,
  },

  // Labels
  labelLarge: {
    fontFamily,
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    fontWeight: '600' as const,
  },
  label: {
    fontFamily,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '500' as const,
  },
  labelSmall: {
    fontFamily,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    fontWeight: '500' as const,
  },

  // Labels (extended)
  labelXS: {
    fontFamily,
    fontSize: moderateScale(10),
    lineHeight: moderateScale(14),
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },

  // Caption
  caption: {
    fontFamily,
    fontSize: moderateScale(11),
    lineHeight: moderateScale(14),
    fontWeight: '400' as const,
  },

  // Overline
  overline: {
    fontFamily,
    fontSize: moderateScale(10),
    lineHeight: moderateScale(14),
    fontWeight: '600' as const,
    letterSpacing: 1.5,
  },

  // Stat unit
  statUnit: {
    fontFamily,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    fontWeight: '700' as const,
  },

  // Micro
  micro: {
    fontFamily,
    fontSize: moderateScale(9),
    lineHeight: moderateScale(12),
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },

  // Display Focus (large centered number)
  displayFocus: {
    fontFamily,
    fontSize: moderateScale(48),
    lineHeight: moderateScale(56),
    fontWeight: '700' as const,
    letterSpacing: -1,
  },

  // Stat value
  statValue: {
    fontFamily,
    fontSize: moderateScale(20),
    lineHeight: moderateScale(28),
    fontWeight: '700' as const,
  },
} as const;

export type Typography = typeof typography;
