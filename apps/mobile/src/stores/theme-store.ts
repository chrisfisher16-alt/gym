// ── Theme Store ──────────────────────────────────────────────────────
// Manages color mode preference: light, dark, or auto (follows system).

import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  /** User preference: light, dark, or auto */
  colorMode: ColorMode;
  /** Resolved scheme after applying auto logic */
  resolvedScheme: 'light' | 'dark';
  /** Whether the store has loaded from AsyncStorage */
  isInitialized: boolean;

  initialize: () => Promise<void>;
  setColorMode: (mode: ColorMode) => void;
}

const STORAGE_KEY = '@theme/colorMode';

function resolveScheme(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';

  // Auto: check system preference
  const systemScheme = Appearance.getColorScheme();
  if (systemScheme === 'dark' || systemScheme === 'light') return systemScheme;

  // Fallback: use time-based (dark from 7pm to 7am)
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7 ? 'dark' : 'light';
}

function safeSetColorScheme(mode: ColorMode) {
  if (Platform.OS === 'web') return;
  try {
    if (mode === 'auto') {
      Appearance.setColorScheme(undefined as any);
    } else {
      Appearance.setColorScheme(mode);
    }
  } catch {
    // setColorScheme may not be available on all RN versions
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorMode: 'auto',
  resolvedScheme: resolveScheme('auto'),
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        const resolved = resolveScheme(stored);
        set({ colorMode: stored, resolvedScheme: resolved, isInitialized: true });
        safeSetColorScheme(stored);
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setColorMode: (mode: ColorMode) => {
    const resolved = resolveScheme(mode);
    set({ colorMode: mode, resolvedScheme: resolved });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
    safeSetColorScheme(mode);
  },
}));

// Listen for system appearance changes to update auto mode
Appearance.addChangeListener(({ colorScheme }) => {
  const state = useThemeStore.getState();
  if (state.colorMode === 'auto') {
    const resolved = colorScheme === 'dark' ? 'dark' : 'light';
    useThemeStore.setState({ resolvedScheme: resolved });
  }
});
