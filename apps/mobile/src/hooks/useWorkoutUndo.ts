import { useCallback, useRef, useSyncExternalStore } from 'react';

// ── Types ───────────────────────────────────────────────────────────

export interface UndoAction {
  id: string;
  description: string; // e.g. "Completed Set 3 — Bench Press 90lb × 5"
  timestamp: number;
  undo: () => void; // closure that reverses the action
}

export interface WorkoutUndoState {
  undoStack: ReadonlyArray<UndoAction>;
  pushUndo: (action: UndoAction) => void;
  popUndo: () => UndoAction | null;
  clearStack: () => void;
  canUndo: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const MAX_UNDO_DEPTH = 3;

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Lightweight LIFO undo stack for active workout actions.
 * Uses refs + useSyncExternalStore for minimal re-renders —
 * only the `canUndo` boolean and `undoStack` trigger React updates.
 */
export function useWorkoutUndo(): WorkoutUndoState {
  const stackRef = useRef<UndoAction[]>([]);
  const versionRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => versionRef.current, []);

  // Subscribe to version changes so React re-renders when stack mutates
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const notify = useCallback(() => {
    versionRef.current += 1;
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const pushUndo = useCallback(
    (action: UndoAction) => {
      stackRef.current = [...stackRef.current, action].slice(-MAX_UNDO_DEPTH);
      notify();
    },
    [notify],
  );

  const popUndo = useCallback((): UndoAction | null => {
    const stack = stackRef.current;
    if (stack.length === 0) return null;

    const last = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    notify();

    return last;
  }, [notify]);

  const clearStack = useCallback(() => {
    if (stackRef.current.length === 0) return;
    stackRef.current = [];
    notify();
  }, [notify]);

  return {
    undoStack: stackRef.current,
    pushUndo,
    popUndo,
    clearStack,
    canUndo: stackRef.current.length > 0,
  };
}
