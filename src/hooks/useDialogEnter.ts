import { useEffect, useRef } from 'react';

/**
 * Registers a global Enter keydown listener while `active` is true.
 * Calls `handler` on each Enter press.
 */
export function useDialogEnter(active: boolean, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlerRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}