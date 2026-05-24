'use client';

import type { CustomerRequest, ProgrammingLanguage } from './types';
import { PROGRAMMING_LANGUAGES, LANGUAGE_NAMES } from './types';

interface Props {
  activeCustomer: CustomerRequest | null;
  workshopCode: string;
  setWorkshopCode: (v: string) => void;
  workshopLanguage: ProgrammingLanguage;
  setWorkshopLanguage: (v: ProgrammingLanguage) => void;
  workshopOutput: string;
  inWorkshopRoom: boolean;
  runWorkshopCode: () => void;
  reopenWorkshopIntro: () => void;
  showSparkyExamples: () => void;
  leaveWorkshopRoom: () => void;
  bonusFraction: number;
  bonusDuration: number;
  firstTransactionDone: boolean;
}

export default function WorkshopPanel({
  activeCustomer, workshopCode, setWorkshopCode, workshopLanguage, setWorkshopLanguage, workshopOutput,
  inWorkshopRoom, runWorkshopCode, reopenWorkshopIntro, showSparkyExamples, leaveWorkshopRoom,
  bonusFraction, bonusDuration, firstTransactionDone,
}: Props) {
  const bonusAmount = Math.round(5 * bonusFraction);
  const isDataProcessing = activeCustomer?.requestType === 'data-processing';

  return (
    <>
      {inWorkshopRoom && activeCustomer && (
        <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-cyan-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl">
          <div className="text-sky-300 text-lg font-semibold">{activeCustomer.customerName}'s Request</div>

          {isDataProcessing && activeCustomer.dataSteps ? (
            <div className="mt-2">
              <div className="text-sky-100">{activeCustomer.dataSteps[0].description}</div>
              <pre className="mt-2 rounded-lg bg-slate-950 border border-slate-700 p-3 font-mono text-sm text-emerald-300 leading-relaxed">
                {activeCustomer.dataSteps[0].givenInfo.length > 0 ? (
                  activeCustomer.dataSteps[0].givenInfo.map((line, i) => (
                    <div key={i}><code>{line}</code></div>
                  ))
                ) : (
                  <div className="text-slate-400 italic">(no data shown — write from scratch)</div>
                )}
              </pre>
              <div className="mt-1 text-xs text-slate-400">
                Write {activeCustomer.dataSteps[0].expectedCode.length} statement{activeCustomer.dataSteps[0].expectedCode.length > 1 ? 's' : ''}:
              </div>
            </div>
          ) : (
            <>
              {activeCustomer.required.includes('name') && <div className="mt-1">Name: <span className="font-semibold text-emerald-300">{activeCustomer.petName}</span></div>}
              {activeCustomer.required.includes('color') && <div className="mt-1">Color: <span className="font-semibold text-emerald-300">{activeCustomer.petColor}</span></div>}
              {activeCustomer.required.includes('size') && <div className="mt-1">Size (int): <span className="font-semibold text-emerald-300">{activeCustomer.petSize}</span></div>}
              <div className="mt-1 text-sky-100">"I want my robot to have these settings!"</div>
            </>
          )}

          {bonusFraction > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span>Speed bonus: ${bonusAmount}</span>
                <span>{Math.ceil(bonusFraction * bonusDuration)}s left</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${bonusFraction * 100}%`,
                    background: bonusFraction > 0.5
                      ? 'linear-gradient(90deg, #22c55e, #eab308)'
                      : 'linear-gradient(90deg, #eab308, #ef4444)',
                  }}
                />
              </div>
              {!firstTransactionDone && (
                <div className="mt-1 text-xs text-amber-400 animate-pulse">↑ If you do it fast, you get a bonus!</div>
              )}
            </div>
          )}

          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-base text-slate-200">Workshop Editor</span>
              <select 
                value={workshopLanguage} 
                onChange={(e) => setWorkshopLanguage(e.target.value as ProgrammingLanguage)}
                className="px-3 py-1.5 text-sm rounded bg-slate-800 text-slate-100 border border-slate-600 hover:border-slate-500 cursor-pointer"
              >
                {PROGRAMMING_LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{LANGUAGE_NAMES[lang]}</option>
                ))}
              </select>
            </div>
            <textarea value={workshopCode} onChange={(e) => setWorkshopCode(e.target.value)} spellCheck={false} wrap="off" className="h-28 w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]" />
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" className="rounded bg-emerald-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-400" onClick={runWorkshopCode}>Submit {LANGUAGE_NAMES[workshopLanguage]} Code</button>
            <button type="button" className="rounded bg-amber-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-amber-500" onClick={showSparkyExamples}>Need help?</button>
          </div>
        </div>
      )}

      {workshopOutput && (
        <div className="absolute left-4 bottom-20 z-40 w-[min(90vw,24rem)] rounded-xl border border-emerald-300/40 bg-emerald-950/70 px-4 py-3 text-base text-emerald-100 shadow-xl">{workshopOutput}</div>
      )}

      {inWorkshopRoom && (
        <div className="absolute right-4 top-20 z-40 flex gap-3">
          <button type="button" className="rounded bg-slate-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-slate-600" onClick={reopenWorkshopIntro}>Workshop guide</button>
          <button type="button" className="rounded bg-blue-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-blue-400" onClick={leaveWorkshopRoom}>Exit workshop</button>
        </div>
      )}
    </>
  );
}
