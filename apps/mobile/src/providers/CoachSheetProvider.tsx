import React, { createContext, useCallback, useContext, useState } from 'react';

interface CoachSheetContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CoachSheetContext = createContext<CoachSheetContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useCoachSheet() {
  return useContext(CoachSheetContext);
}

export function CoachSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <CoachSheetContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CoachSheetContext.Provider>
  );
}
