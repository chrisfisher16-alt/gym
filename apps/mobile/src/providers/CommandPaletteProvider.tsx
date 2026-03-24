import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// ── Recent Actions ─────────────────────────────────────────────────

export interface RecentAction {
  label: string;
  timestamp: number;
  icon: string;
}

const MAX_RECENT = 5;

// ── Context ────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  recentActions: ReadonlyArray<RecentAction>;
  trackAction: (label: string, icon: string) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
  recentActions: [],
  trackAction: () => {},
});

// ── Provider ───────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const recentRef = useRef<RecentAction[]>([]);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const trackAction = useCallback((label: string, icon: string) => {
    const action: RecentAction = { label, timestamp: Date.now(), icon };
    const updated = [action, ...recentRef.current.filter((a) => a.label !== label)].slice(
      0,
      MAX_RECENT,
    );
    recentRef.current = updated;
    setRecentActions(updated);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, close, isOpen: visible, recentActions, trackAction }),
    [open, close, visible, recentActions, trackAction],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
