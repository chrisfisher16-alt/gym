export const lightColors = {
  // Primary — warm gold
  primary: '#C4A265',
  primaryLight: '#D4B97A',
  primaryDark: '#A8874E',
  primaryMuted: '#F5EFE0',

  // Background
  background: '#FAFAF7',
  surface: '#FAF9F6',
  surfaceSecondary: '#F5F3EE',

  // Text
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
  textInverse: '#FFFFFF',

  // Border
  border: '#E5E3DE',
  borderLight: '#F0EEE9',

  // Status
  success: '#059669',
  successLight: '#D1FAE5',
  successVibrant: '#10B981',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // PR / Achievements
  gold: '#C4A265',
  goldLight: '#F5EFE0',

  // Disabled
  disabled: '#D1D1CB',
  disabledText: '#9A9A9A',

  // Macros
  protein: '#EF4444',
  carbs: '#3B82F6',
  fat: '#F59E0B',
  fiber: '#10B981',
  calories: '#8B5CF6',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayHeavy: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.08)',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9A9A9A',

  // Onboarding / extended
  divider: '#E5E3DE',
  textOnPrimary: '#FFFFFF',
  primaryDim: 'rgba(196, 162, 101, 0.5)',
  borderBrand: '#C4A265',

  // Medals
  medalGold: '#C4A265',
  medalSilver: '#9CA3AF',
  medalBronze: '#B87333',

  // Extended surfaces
  surfaceTertiary: '#EDEBE6',
  barBlur: 'rgba(250, 250, 247, 0.85)',

  // PR / Anatomy
  prBg: '#FEF3C7',
  anatomyOutline: '#D1D1CB',
  anatomyDefault: '#E5E3DE',

  // Charts
  chartLine: '#C4A265',
  chartArea: 'rgba(196, 162, 101, 0.15)',
  chartGrid: '#E5E3DE',

  // Heatmap
  heatmapEmpty: '#F0EEE9',
  heatmapLow: '#F5EFE0',
  heatmapMid: '#D4B97A',
  heatmapHigh: '#C4A265',

  // Superset
  triSet: '#8B5CF6',
};

export const darkColors: typeof lightColors = {
  // Primary — warm gold
  primary: '#C4A265',
  primaryLight: '#D4B97A',
  primaryDark: '#A8874E',
  primaryMuted: '#2A2418',

  // Background — true black
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceSecondary: '#252525',

  // Text
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',
  textInverse: '#0D0D0D',

  // Border
  border: '#2A2A2A',
  borderLight: '#1A1A1A',

  // Status
  success: '#10B981',
  successLight: '#064E3B',
  successVibrant: '#34D399',
  warning: '#FBBF24',
  warningLight: '#78350F',
  error: '#F87171',
  errorLight: '#7F1D1D',
  info: '#60A5FA',
  infoLight: '#1E3A5F',

  // PR / Achievements
  gold: '#C4A265',
  goldLight: '#2A2418',

  // Disabled
  disabled: '#3A3A3A',
  disabledText: '#6B6B6B',

  // Macros
  protein: '#F87171',
  carbs: '#60A5FA',
  fat: '#FBBF24',
  fiber: '#34D399',
  calories: '#A78BFA',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayHeavy: 'rgba(0, 0, 0, 0.85)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  tabBar: '#1A1A1A',
  tabBarInactive: '#6B6B6B',

  // Onboarding / extended
  divider: '#2A2A2A',
  textOnPrimary: '#FFFFFF',
  primaryDim: 'rgba(196, 162, 101, 0.35)',
  borderBrand: '#C4A265',

  // Medals
  medalGold: '#C4A265',
  medalSilver: '#9CA3AF',
  medalBronze: '#B87333',

  // Extended surfaces
  surfaceTertiary: '#2F2F2F',
  barBlur: 'rgba(13, 13, 13, 0.85)',

  // PR / Anatomy
  prBg: '#78350F',
  anatomyOutline: '#3A3A3A',
  anatomyDefault: '#2A2A2A',

  // Charts
  chartLine: '#C4A265',
  chartArea: 'rgba(196, 162, 101, 0.15)',
  chartGrid: '#2A2A2A',

  // Heatmap
  heatmapEmpty: '#1A1A1A',
  heatmapLow: '#2A2418',
  heatmapMid: '#A8874E',
  heatmapHigh: '#C4A265',

  // Superset
  triSet: '#A78BFA',
};

export type Colors = typeof lightColors;
