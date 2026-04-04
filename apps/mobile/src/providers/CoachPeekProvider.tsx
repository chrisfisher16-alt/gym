import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CoachPeek } from '../components/ui/CoachPeek';
import { useCoachStore } from '../stores/coach-store';

// ── Context ──────────────────────────────────────────────────────────

export interface CoachPeekContextType {
  showPeek: (message: string, coachPrompt?: string) => void;
  dismissPeek: () => void;
  hasShownPeek: boolean;
}

const CoachPeekContext = createContext<CoachPeekContextType>({
  showPeek: () => {},
  dismissPeek: () => {},
  hasShownPeek: false,
});

export function useCoachPeek(): CoachPeekContextType {
  return useContext(CoachPeekContext);
}

// ── Constants ────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = 56; // matches (tabs)/_layout.tsx tabBarStyle.height

// ── Provider ─────────────────────────────────────────────────────────

interface PeekState {
  message: string;
  coachPrompt?: string;
}

export function CoachPeekProvider({ children }: { children: React.ReactNode }) {
  const [peek, setPeek] = useState<PeekState | null>(null);
  const hasShownRef = useRef(false);
  const [hasShownPeek, setHasShownPeek] = useState(false);
  const insets = useSafeAreaInsets();
  const setPrefilledContext = useCoachStore((s) => s.setPrefilledContext);

  const showPeek = useCallback((message: string, coachPrompt?: string) => {
    if (hasShownRef.current) return; // enforce 1-per-session
    hasShownRef.current = true;
    setHasShownPeek(true);
    setPeek({ message, coachPrompt });
  }, []);

  const dismissPeek = useCallback(() => {
    setPeek(null);
  }, []);

  const handleExpand = useCallback(() => {
    if (peek?.coachPrompt) {
      setPrefilledContext('general', peek.coachPrompt);
    }
    setPeek(null);
    router.push('/(tabs)/coach');
  }, [peek, setPrefilledContext]);

  // bottom: safe area inset + tab bar height + 12px gap
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 12;

  return (
    <CoachPeekContext.Provider value={{ showPeek, dismissPeek, hasShownPeek }}>
      {children}
      {peek && (
        <CoachPeek
          message={peek.message}
          coachPrompt={peek.coachPrompt}
          onDismiss={dismissPeek}
          onExpand={handleExpand}
          bottomOffset={bottomOffset}
        />
      )}
    </CoachPeekContext.Provider>
  );
}
