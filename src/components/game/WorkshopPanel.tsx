'use client';

import type { CustomerRequest } from './types';

interface Props {
  activeCustomer: CustomerRequest | null;
  workshopCode: string;
  setWorkshopCode: (v: string) => void;
  workshopOutput: string;
  inWorkshopRoom: boolean;
  runWorkshopCode: () => void;
  reopenWorkshopIntro: () => void;
  leaveWorkshopRoom: () => void;
}

export default function WorkshopPanel({
  activeCustomer, workshopCode, setWorkshopCode, workshopOutput,
  inWorkshopRoom, runWorkshopCode, reopenWorkshopIntro, leaveWorkshopRoom,
}: Props) {
  return (
    <>
      {inWorkshopRoom && activeCustomer && (
        <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-cyan-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl">
          <div className="text-sky-300 text-lg font-semibold">{activeCustomer.customerName}'s Request</div>
          {activeCustomer.required.includes('name') && <div className="mt-1">Name: <span className="font-semibold text-emerald-300">{activeCustomer.petName}</span></div>}
          {activeCustomer.required.includes('color') && <div className="mt-1">Color: <span className="font-semibold text-emerald-300">{activeCustomer.petColor}</span></div>}
          {activeCustomer.required.includes('size') && <div className="mt-1">Size (int): <span className="font-semibold text-emerald-300">{activeCustomer.petSize}</span></div>}
          <div className="mt-1 text-sky-100">"I want a pet with these settings!"</div>

          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-4 py-2 text-base text-slate-200 border-b border-slate-800">Java Workshop Editor</div>
            <textarea value={workshopCode} onChange={(e) => setWorkshopCode(e.target.value)} spellCheck={false} wrap="off" className="h-28 w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]" />
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" className="rounded bg-emerald-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-400" onClick={runWorkshopCode}>Submit Java Code</button>
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
