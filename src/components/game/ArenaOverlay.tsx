'use client';

interface ArenaPlayer {
  id: string;
  name: string;
}

interface ArenaChallenge {
  id?: string;
  fromId?: string;
  fromName?: string;
  toId?: string;
  toName?: string;
  status: 'pending' | 'active' | 'accepted' | 'declined';
}

interface Props {
  inArenaRoom: boolean;
  arenaPlayers: ArenaPlayer[];
  arenaChallenge: ArenaChallenge | null;
  arenaCode: string;
  setArenaCode: (v: string) => void;
  arenaOutput: string;
  arenaBattleActive: boolean;
  challengePlayer: (id: string, name: string) => void;
  acceptChallenge: (fromId: string) => void;
  declineChallenge: () => void;
  submitArenaCode: () => void;
  leaveArenaRoom: () => void;
}

export default function ArenaOverlay({
  inArenaRoom, arenaPlayers, arenaChallenge, arenaCode, setArenaCode,
  arenaOutput, arenaBattleActive, challengePlayer, acceptChallenge,
  declineChallenge, submitArenaCode, leaveArenaRoom,
}: Props) {
  if (!inArenaRoom) return null;

  return (
    <>
      <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-red-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl">
        <div className="font-semibold text-red-400 text-lg">Arena PvP</div>
        <div className="mt-2 text-slate-300">Players in arena:</div>
        <div className="mt-1 space-y-1">
          {arenaPlayers.length === 0 && <div className="text-slate-500 italic">No other players yet.</div>}
          {arenaPlayers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2">
              <span className="text-slate-100">{p.name}</span>
              <button type="button" className="rounded bg-red-500 px-3 py-1 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-40" disabled={arenaBattleActive} onClick={() => challengePlayer(p.id, p.name)}>Challenge</button>
            </div>
          ))}
        </div>

        {arenaChallenge?.status === 'pending' && arenaChallenge.fromId && (
          <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-950/60 px-4 py-3">
            <div className="text-amber-200 font-semibold">{arenaChallenge.fromName} challenges you!</div>
            <div className="mt-2 flex gap-3">
              <button type="button" className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400" onClick={() => acceptChallenge(arenaChallenge.fromId!)}>Accept</button>
              <button type="button" className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500" onClick={declineChallenge}>Decline</button>
            </div>
          </div>
        )}

        {arenaChallenge?.status === 'pending' && arenaChallenge.toId && !arenaChallenge.fromId && (
          <div className="mt-3 text-sky-300">Challenge sent to {arenaChallenge.toName}. Waiting for response...</div>
        )}

        {arenaBattleActive && (
          <div className="mt-4">
            <div className="rounded-xl border border-red-700 bg-slate-950 overflow-hidden">
              <div className="px-4 py-2 text-base text-slate-200 border-b border-slate-800">Arena Code Editor</div>
              <textarea value={arenaCode} onChange={(e) => setArenaCode(e.target.value)} spellCheck={false} wrap="off" className="h-28 w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-base leading-7 text-slate-100 [font-variant-ligatures:none]" />
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" className="rounded bg-red-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-red-400" onClick={submitArenaCode}>Submit Code</button>
            </div>
          </div>
        )}

        {arenaOutput && (
          <div className="mt-3 rounded-lg border border-red-300/40 bg-red-950/70 px-4 py-3 text-base text-red-100">{arenaOutput}</div>
        )}
      </div>

      <div className="absolute right-4 top-20 z-40">
        <button type="button" className="rounded bg-blue-500 px-4 py-2.5 text-base font-semibold text-white hover:bg-blue-400" onClick={leaveArenaRoom}>Exit arena</button>
      </div>
    </>
  );
}
