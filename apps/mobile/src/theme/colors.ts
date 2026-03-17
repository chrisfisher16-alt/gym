export const lightColors = {
  // Primary
  primary: '#0891B2',
  primaryLight: '#22D3EE',
  primaryDark: '#0E7490',
  primaryMuted: '#E0F7FA',

  // Background
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F5',

  // Text
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Border
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

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
  gold: '#D97706',
  goldLight: '#FEF3C7',

  // Disabled
  disabled: '#D1D5DB',
  disabledText: '#9CA3AF',

  // Macros
  protein: '#EF4444',
  carbs: '#3B82F6',
  fat: '#F59E0B',
  fiber: '#10B981',
  calories: '#8B5CF6',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.08)',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9CA3AF',
};

export const darkColors: typeof lightColors = {
  // Primary
  primary: '#22D3EE',
  primaryLight: '#67E8F9',
  primaryDark: '#0891B2',
  primaryMuted: '#164E63',

  // Background
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',

  // Text
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',

  // Border
  border: '#334155',
  borderLight: '#1E293B',

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
  gold: '#FBBF24',
  goldLight: '#78350F',

  // Disabled
  disabled: '#475569',
  disabledText: '#64748B',

  // Macros
  protein: '#F87171',
  carbs: '#60A5FA',
  fat: '#FBBF24',
  fiber: '#34D399',
  calories: '#A78BFA',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  tabBar: '#1E293B',
  tabBarInactive: '#64748B',
};

export type Colors = typeof lightColors;
