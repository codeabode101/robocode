'use client';

import { type RefObject } from 'react';

interface EditorProps {
  code: string;
  setCode: (value: string) => void;
  highlightedCode: string;
  codeInputRef: RefObject<HTMLTextAreaElement | null>;
  codePreviewRef: RefObject<HTMLPreElement | null>;
  onEditorScroll: () => void;
}

export default function Editor({ code, setCode, highlightedCode, codeInputRef, codePreviewRef, onEditorScroll }: EditorProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="px-4 py-2 text-sm text-slate-200 border-b border-slate-800">
        Java Editor
      </div>
      <div className="relative h-40">
        <pre
          ref={codePreviewRef}
          className="pointer-events-none absolute inset-0 m-0 p-4 overflow-auto whitespace-pre font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]"
          dangerouslySetInnerHTML={{ __html: `${highlightedCode}\n` }}
        />
        <textarea
          ref={codeInputRef}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onScroll={onEditorScroll}
          spellCheck={false}
          wrap="off"
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-transparent caret-green-300 [font-variant-ligatures:none]"
        />
      </div>
    </div>
  );
}
