'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
  placeholder?: string;
  autoFocus?: boolean;
  containerClassName?: string;
  textareaClassName?: string;
}

export default function CodeInput({
  value, onChange, minHeight, placeholder,
  autoFocus, containerClassName, textareaClassName,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cx, setCx] = useState(0);
  const [cy, setCy] = useState(0);

  const updatePos = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = value.substring(0, pos);
    const lines = before.split('\n');
    const row = lines.length - 1;
    const col = lines[row];

    const style = getComputedStyle(ta);
    const pt = parseFloat(style.paddingTop);
    const pl = parseFloat(style.paddingLeft);
    const lh = parseFloat(style.lineHeight);
    const fontSize = style.fontSize;
    const fontFamily = style.fontFamily;

    let textWidth = 0;
    if (col.length > 0) {
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.font = `${fontSize} ${fontFamily}`;
      textWidth = ctx.measureText(col).width;
    }

    setCx(pl + textWidth);
    setCy(pt + row * lh);
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      if (document.pointerLockElement) document.exitPointerLock();
      const t = setTimeout(() => {
        taRef.current?.focus();
        updatePos();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus, updatePos]);

  return (
    <div className={`relative ${containerClassName ?? ''}`}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={updatePos}
        onClick={updatePos}
        onSelect={updatePos}
        spellCheck={false}
        wrap="off"
        placeholder={placeholder}
        className={`w-full resize-none overflow-auto whitespace-pre bg-transparent font-mono caret-transparent ${textareaClassName ?? ''}`}
        style={minHeight ? { minHeight } : undefined}
      />
      <span
        className="absolute pointer-events-none font-mono animate-blink-cursor"
        style={{
          top: cy,
          left: cx,
          color: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        }}
      >_</span>
      <style>{`
        @keyframes blink-cursor {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-blink-cursor {
          animation: blink-cursor 530ms step-end infinite;
        }
      `}</style>
    </div>
  );
}
