'use client';

import { type RefObject, useRef, useEffect } from 'react';
import type { TutorialPhase } from './types';
import Editor from './Editor';

interface Props {
  showTutorial: boolean;
  tutorialStep: number;
  setTutorialStep: (v: number | ((prev: number) => number)) => void;
  code: string;
  setCode: (v: string) => void;
  highlightedCode: string;
  output: string;
  setOutput: (v: string) => void;
  success: boolean;
  setSuccess: (v: boolean) => void;
  sparkleBurst: boolean;
  codeInputRef: RefObject<HTMLTextAreaElement | null>;
  codePreviewRef: RefObject<HTMLPreElement | null>;
  onEditorScroll: () => void;
  checkAnswer: () => void;
  setShowTutorial: (v: boolean) => void;
  tutorialPhases: TutorialPhase[];
}

export default function TutorialOverlay({
  showTutorial, tutorialStep, setTutorialStep,
  code, setCode, highlightedCode,
  output, setOutput, success, setSuccess, sparkleBurst,
  codeInputRef, codePreviewRef, onEditorScroll,
  checkAnswer, setShowTutorial, tutorialPhases,
}: Props) {
  if (!showTutorial) return null;

  const phase = tutorialPhases[tutorialStep];
  const isChallenge = phase.kind === 'challenge';
  const isCodeDone = success && isChallenge;

  const handleOkay = () => {
    if (isChallenge && !success) {
      checkAnswer();
      return;
    }
    const nextStep = tutorialStep + 1;
    const nextPhase = tutorialPhases[nextStep];
    if (isCodeDone) {
      setSuccess(false);
      setOutput('');
    }
    if (nextPhase && nextPhase.kind === 'challenge') {
      setTutorialStep(nextStep);
      setCode(nextPhase.starterCode);
    } else {
      setShowTutorial(false);
      setTutorialStep(0);
    }
  };

  const handleOkayRef = useRef(handleOkay);
  handleOkayRef.current = handleOkay;

  useEffect(() => {
    if (!showTutorial) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLElement && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
      e.preventDefault();
      handleOkayRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTutorial]);

  const bubbleBtnText = isCodeDone ? 'Next →' : isChallenge ? 'Run Code' : 'Okay.';

  return (
    <>
      {/* Dim backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" />

      {/* Challenge editor panel — above the bubble */}
      {isChallenge && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-sm">
            {sparkleBurst && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                <span className="absolute left-6 top-2 text-yellow-300 animate-ping text-lg">✨</span>
                <span className="absolute right-8 top-4 text-pink-300 animate-ping text-lg">✨</span>
                <span className="absolute right-4 bottom-4 text-cyan-300 animate-ping text-lg">✨</span>
              </div>
            )}
            <div className="mb-2 rounded-lg border border-slate-700/70 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
              <div className="font-semibold text-slate-100">{phase.title}</div>
              <div className="mt-0.5">{phase.prompt}</div>
              <div className="mt-1 text-sky-300 text-xs" dangerouslySetInnerHTML={{ __html: phase.hint }} />
            </div>
            <Editor code={code} setCode={setCode} highlightedCode={highlightedCode} codeInputRef={codeInputRef} codePreviewRef={codePreviewRef} onEditorScroll={onEditorScroll} />
            {output && (
              <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${success ? 'bg-emerald-900/70 text-emerald-100' : 'bg-rose-900/70 text-rose-100'}`}>
                {output}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogue bubble — bottom of screen */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-3 pb-3">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-sm">
          <div className={`mt-1 text-3xl shrink-0 ${success ? 'animate-bounce' : ''}`}>🤖</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-base">Sparky</div>
            <p
              className="mt-1 text-sm text-slate-100 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: phase.npcText }}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                {tutorialPhases.map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${tutorialStep === i ? 'bg-blue-500' : 'bg-slate-600'}`} />
                ))}
              </div>
              <button
                onClick={handleOkay}
                className={`rounded-lg px-5 py-2 text-sm font-semibold ${
                  isCodeDone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : isChallenge
                    ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {bubbleBtnText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
