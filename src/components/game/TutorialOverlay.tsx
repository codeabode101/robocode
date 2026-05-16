'use client';

import { type RefObject } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
        {sparkleBurst && (
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-8 top-6 text-yellow-300 animate-ping">✨</span>
            <span className="absolute right-10 top-12 text-pink-300 animate-ping">✨</span>
            <span className="absolute right-16 bottom-8 text-cyan-300 animate-ping">✨</span>
          </div>
        )}

        <div className="flex items-start gap-4 mb-5">
          <div className={`text-4xl ${success ? 'animate-bounce' : ''}`}>🤖</div>
          <div className="flex-1">
            <h2 className="text-white text-2xl font-bold">Sparky</h2>
            <p
              className="mt-2 text-lg text-slate-100"
              dangerouslySetInnerHTML={{ __html: tutorialPhases[tutorialStep].npcText }}
            />
          </div>
        </div>

        {tutorialPhases[tutorialStep].kind === 'challenge' && (
          <div className="mb-4">
            <div className="mb-3 rounded-lg border border-slate-700/70 bg-slate-800/70 px-4 py-3 text-base text-slate-100">
              <div className="font-semibold text-slate-100 text-lg">{tutorialPhases[tutorialStep].title}</div>
              <div className="mt-1">{tutorialPhases[tutorialStep].prompt}</div>
              <div className="mt-2 text-sky-300" dangerouslySetInnerHTML={{ __html: tutorialPhases[tutorialStep].hint }} />
            </div>
            <Editor code={code} setCode={setCode} highlightedCode={highlightedCode} codeInputRef={codeInputRef} codePreviewRef={codePreviewRef} onEditorScroll={onEditorScroll} />
            {output && (
              <div className={`mt-3 rounded-lg px-4 py-3 text-base ${success ? 'bg-emerald-900/70 text-emerald-100' : 'bg-rose-900/70 text-rose-100'}`}>
                {output}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {tutorialPhases.map((_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${tutorialStep === i ? 'bg-blue-500' : 'bg-slate-600'}`} />
            ))}
          </div>

          {tutorialPhases[tutorialStep].kind === 'dialogue' ? (
            <button onClick={() => setTutorialStep((step) => step + 1)} className="rounded-lg bg-blue-600 px-6 py-3 text-base text-white font-semibold hover:bg-blue-500">Next</button>
          ) : success ? (
            <button onClick={() => {
              const nextStep = tutorialStep + 1;
              const nextPhase = tutorialPhases[nextStep];
              setSuccess(false);
              setOutput('');
              if (nextPhase && nextPhase.kind === 'challenge') {
                setTutorialStep(nextStep);
                setCode(nextPhase.starterCode);
              } else {
                setShowTutorial(false);
                setTutorialStep(0);
              }
            }} className="rounded-lg bg-emerald-600 px-6 py-3 text-base text-white font-semibold hover:bg-emerald-500">Next →</button>
          ) : (
            <button onClick={checkAnswer} className="rounded-lg px-6 py-3 text-base font-semibold bg-amber-500 text-slate-900 hover:bg-amber-400">Run Code</button>
          )}
        </div>
      </div>
    </div>
  );
}
