import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { QuickInputPill } from '../components/ui/QuickInputPill';

// ── Context ──────────────────────────────────────────────────────────

interface QuickInputContextValue {
  show: () => void;
  hide: () => void;
  isVisible: boolean;
}

const QuickInputContext = createContext<QuickInputContextValue>({
  show: () => {},
  hide: () => {},
  isVisible: true,
});

// ── Provider ─────────────────────────────────────────────────────────

export function QuickInputProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  const value = useMemo<QuickInputContextValue>(
    () => ({ show, hide, isVisible: visible }),
    [show, hide, visible],
  );

  return (
    <QuickInputContext.Provider value={value}>
      {children}
      {/* QuickInputPill removed — CoachFAB + per-tab FABs handle quick actions */}
    </QuickInputContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useQuickInput(): QuickInputContextValue {
  return useContext(QuickInputContext);
}
