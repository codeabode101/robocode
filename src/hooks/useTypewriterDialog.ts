import { useEffect } from 'react';

export interface DialogStep {
  speaker: string;
  text: string;
}

/**
 * Drives the typewriter animation effect in a dialog.
 * Calls `setText` on each character tick so the parent component
 * (which owns the text state) re-renders with the latest partial text.
 */
export function useTypewriterDialog(
  show: boolean,
  step: number,
  steps: DialogStep[] | readonly DialogStep[],
  setText: (t: string) => void,
  charInterval = 35,
): void {
  useEffect(() => {
    if (!show) return;
    const s = (steps as readonly DialogStep[])[step];
    if (!s) return;
    setText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setText(s.text.slice(0, i));
      if (i >= s.text.length) clearInterval(interval);
    }, charInterval);
    return () => clearInterval(interval);
  }, [show, step, steps, setText, charInterval]);
}