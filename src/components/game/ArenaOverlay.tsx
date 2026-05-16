import { useState, useEffect } from 'react';
import type { ArenaPlayer } from './types';

interface BattleResult {
  winner?: number;
  turns?: Array<{
    turn: number; p1Action: string; p2Action: string;
    p1Hp: number; p2Hp: number; p1Damage: number; p2Damage: number;
    message: string;
  }>;
  reason?: string;
  eloDelta?: number;
  userWon?: boolean;
  [key: string]: unknown;
}

interface BattleState {
  round: number; myTurn: boolean; p1Hp: number; p2Hp: number;
  p1Energy: number; p2Energy: number; submitted: boolean;
  revealedAction: string | null; roundHistory: any[];
  turnResult: any; gameOver: boolean; winnerId: string | null;
  p1TimeBank: number; p2TimeBank: number; userWon: boolean;
  currentTurn: string | null; isChallenger: boolean; challengerId: string;
}

interface Props {
  inArenaRoom: boolean;
  arenaPlayers: ArenaPlayer[];
  challengePlayer: (id: string, name: string, wager: number) => void;
  acceptChallenge: (fromId: string, wager: number, challengeId?: string) => void;
  declineChallenge: () => void;
  submitBattleCode: (code: string) => void;
  leaveArenaRoom: () => void;
  currentUserId?: string;
  battleId: string | null;
  battleStatus: string;
  battleActive: boolean;
  battleResult: BattleResult | null;
  waitingForOpponent: boolean;
  myRank: { elo: number; rank_tier: string; wins: number; losses: number };
  arenaChallenge: { id?: string; fromId?: string; fromName?: string; status: string } | null;
  battleState: BattleState | null;
}

const RANK_COLORS: Record<string, string> = {
  bronze: 'text-amber-600',
  silver: 'text-slate-300',
  gold: 'text-yellow-400',
  platinum: 'text-cyan-300',
  diamond: 'text-purple-400',
};

const ACTION_COLORS: Record<string, string> = {
  ATTACK: 'bg-red-600 hover:bg-red-500',
  DEFEND: 'bg-blue-600 hover:bg-blue-500',
  HEAL: 'bg-emerald-600 hover:bg-emerald-500',
  CHARGE: 'bg-yellow-600 hover:bg-yellow-500',
  SPECIAL: 'bg-purple-600 hover:bg-purple-500',
};

function formatTime(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function HealthBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  const pct = Math.max(0, (current / max) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-12 text-right text-slate-400">{label}</div>
      <div className="flex-1 h-3 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-12 text-left font-mono text-slate-200">{current}/{max}</div>
    </div>
  );
}

export default function ArenaOverlay({
  inArenaRoom, arenaPlayers, challengePlayer, acceptChallenge, declineChallenge,
  submitBattleCode, leaveArenaRoom, currentUserId, battleId, battleStatus,
  battleActive, battleResult, waitingForOpponent, myRank, arenaChallenge, battleState,
}: Props) {
  const [wager, setWager] = useState(0);
  const [code, setCode] = useState(`if (myHealth < 5) return "HEAL";
if (myEnergy >= 4 && opponentHealth <= 8) return "SPECIAL";
return "ATTACK";`);

  // real-time chess clock tick
  const [localP1Time, setLocalP1Time] = useState(battleState?.p1TimeBank ?? 240000);
  const [localP2Time, setLocalP2Time] = useState(battleState?.p2TimeBank ?? 240000);
  useEffect(() => {
    if (battleState) {
      setLocalP1Time(battleState.p1TimeBank);
      setLocalP2Time(battleState.p2TimeBank);
    }
  }, [battleState?.p1TimeBank, battleState?.p2TimeBank]);
  useEffect(() => {
    if (!battleActive || !battleState || battleState.gameOver) return;
    const interval = setInterval(() => {
      const p1sTurn = battleState.currentTurn === battleState.challengerId;
      if (p1sTurn) {
        setLocalP1Time((t) => Math.max(0, t - 1000));
      } else {
        setLocalP2Time((t) => Math.max(0, t - 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [battleActive, battleState?.currentTurn, battleState?.challengerId, battleState?.gameOver]);

  if (!inArenaRoom) return null;

  const tierLabel = myRank.rank_tier.charAt(0).toUpperCase() + myRank.rank_tier.slice(1);
  const tierColor = RANK_COLORS[myRank.rank_tier] || 'text-amber-600';

  const isMyTurn = battleState?.myTurn && !battleState?.gameOver;
  const isGameOver = battleState?.gameOver || battleResult;
  const showCodeEditor = isMyTurn && !battleState?.submitted;
  const timelineRounds = battleState?.roundHistory || battleResult?.turns || [];
  const hasTimeline = timelineRounds.length > 0;

  return (
    <>
      <div className="absolute left-4 top-20 z-40 w-[min(90vw,24rem)] rounded-2xl border border-red-200/50 bg-slate-900/94 px-5 py-4 text-base text-slate-100 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-3">
          <div className="font-semibold text-red-400 text-lg">Arena PvP</div>
          <div className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 ${tierColor}`}>
            {tierLabel} ({myRank.elo}) W:{myRank.wins} L:{myRank.losses}
          </div>
        </div>

        {!battleActive && !battleResult && !arenaChallenge && (
          <>
            <div className="mt-2 text-slate-300 text-sm">Players in arena:</div>
            <div className="mt-1 space-y-1 max-h-36 overflow-y-auto">
              {arenaPlayers.length === 0 && <div className="text-slate-500 italic text-sm">No other players yet.</div>}
              {arenaPlayers.filter((p) => p.id !== currentUserId).map((p) => {
                const pr = p.rankTier ? p.rankTier.charAt(0).toUpperCase() + p.rankTier.slice(1) : 'Bronze';
                const pc = RANK_COLORS[p.rankTier || 'bronze'] || 'text-amber-600';
                return (
                  <div key={p.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 text-sm">{p.name}</span>
                      <span className={`text-[10px] font-bold ${pc}`}>{pr}</span>
                    </div>
                    <button type="button" className="rounded bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-400" onClick={() => challengePlayer(p.id, p.name, wager)}>Challenge</button>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="text-xs text-slate-400">Wager:</div>
              <input type="number" min={0} max={100} value={wager} onChange={(e) => setWager(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 border border-slate-700" />
              <div className="text-[10px] text-slate-500">(bet $, winner takes pot)</div>
            </div>
          </>
        )}

        {arenaChallenge && arenaChallenge.status === 'pending' && arenaChallenge.fromId && (
          <div className="mt-3 rounded-lg border border-yellow-600 bg-slate-800 px-4 py-3">
            <div className="text-sm text-yellow-300 font-semibold">Challenge from {arenaChallenge.fromName}!</div>
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400" onClick={() => acceptChallenge(arenaChallenge.fromId!, 0, arenaChallenge.id)}>Accept</button>
              <button type="button" className="rounded bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400" onClick={declineChallenge}>Decline</button>
            </div>
          </div>
        )}

        {/* Round-based battle UI */}
        {battleActive && battleState && !isGameOver && (
          <div className="mt-2">
            {/* HP & Energy bars */}
            <div className="mb-2 space-y-1">
              <HealthBar current={battleState.p1Hp} max={20} label="You (P1)" color="bg-red-500" />
              <HealthBar current={battleState.p2Hp} max={20} label="Opp (P2)" color="bg-blue-500" />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Energy: {battleState.p1Energy}/5</span>
                <span>Energy: {battleState.p2Energy}/5</span>
              </div>
            </div>

            {/* Chess clock / round info */}
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span className={battleState.myTurn ? 'text-cyan-300 font-bold' : ''}>Round {battleState.round + 1} • ⏱ {formatTime(localP1Time)}</span>
              <span>⏱ {formatTime(localP2Time)}</span>
            </div>

            {/* Turn result */}
            {battleState.turnResult && (
              <div className="mb-2 rounded bg-slate-800 px-3 py-2 text-xs text-slate-300">
                <div className="text-emerald-400 font-semibold mb-1">Last turn:</div>
                <div>{battleState.turnResult.message || 'No action'}</div>
                <div className="mt-1 flex gap-3 text-[10px] text-slate-500">
                  <span className="text-red-300">P1 dealt {battleState.turnResult.p1Damage}</span>
                  <span className="text-blue-300">P2 dealt {battleState.turnResult.p2Damage}</span>
                </div>
              </div>
            )}

            {/* Revealed opponent action */}
            {battleState.revealedAction && isMyTurn && !battleState.submitted && (
              <div className="mb-2 rounded bg-yellow-900/50 border border-yellow-600 px-3 py-2 text-xs">
                <span className="text-yellow-300 font-semibold">Opponent's action: </span>
                <span className="text-white font-bold">{battleState.revealedAction}</span>
              </div>
            )}

            {/* Code editor — only when it's my turn */}
            {showCodeEditor && (
              <div className="mt-2">
                <div className="text-xs text-slate-400 mb-1">Your turn — write code for this round:</div>
                <div className="rounded-xl border border-emerald-700 bg-slate-950 overflow-hidden">
                  <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} wrap="off" className="h-28 w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-xs leading-6 text-slate-100 [font-variant-ligatures:none]" />
                </div>
                <div className="mt-1 text-[9px] text-slate-500">Available: myHealth, myEnergy, opponentHealth, opponentEnergy, lastOpponentAction, lastMyAction, round | return "ATTACK"/"DEFEND"/"HEAL"/"CHARGE"/"SPECIAL"</div>
                <button type="button" className="mt-2 w-full rounded bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400" onClick={() => submitBattleCode(code)}>Submit Turn</button>
              </div>
            )}

            {/* Waiting states */}
            {battleState.submitted && !battleState.gameOver && (
              <div className="mt-3 text-sky-300 text-sm">Submitted! Waiting for opponent...</div>
            )}
            {!isMyTurn && !battleState.submitted && !battleState.gameOver && (
              <div className="mt-3 text-amber-300 text-sm">Waiting for opponent's turn...</div>
            )}
          </div>
        )}

        {/* Game Over */}
        {isGameOver && (
          <div className="mt-3">
            {battleResult && battleResult.userWon !== undefined ? (
              <div className={`text-lg font-bold ${battleResult.userWon ? 'text-emerald-400' : 'text-red-400'}`}>
                {battleResult.userWon ? 'You Win!' : 'You Lost'}
              </div>
            ) : battleState?.gameOver ? (
              <div className={`text-lg font-bold ${battleState.userWon ? 'text-emerald-400' : 'text-red-400'}`}>
                {battleState.userWon ? 'You Win!' : 'You Lost'}
              </div>
            ) : null}

            {/* ELO delta */}
            {battleResult?.eloDelta !== undefined && (
              <div className={`text-xs mt-1 ${(battleResult.eloDelta || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ELO {(battleResult.eloDelta || 0) >= 0 ? '+' : ''}{battleResult.eloDelta}
              </div>
            )}

            {/* Battle timeline */}
            {hasTimeline && (
              <>
                <div className="mt-3 text-xs text-slate-300 font-semibold">Battle Timeline:</div>
                <div className="mt-1 max-h-48 overflow-y-auto space-y-1">
                  {(timelineRounds).map((t: any, i: number) => (
                    <div key={i} className={`rounded px-2.5 py-1.5 text-[11px] ${i % 2 === 0 ? 'bg-slate-800/70' : 'bg-slate-850/50'}`}>
                      <span className="text-slate-500 font-mono">R{t.round || (i + 1)}</span>
                      <span className="mx-1 text-slate-400">|</span>
                      <span className="text-red-300">{t.p1Action || '?'}</span>
                      <span className="mx-1 text-slate-600">vs</span>
                      <span className="text-blue-300">{t.p2Action || '?'}</span>
                      <span className="mx-1 text-slate-400">|</span>
                      <span className={t.p1Damage > 0 ? 'text-red-400' : 'text-slate-500'}>-{t.p1Damage}</span>
                      <span className="mx-0.5 text-slate-600">/</span>
                      <span className={t.p2Damage > 0 ? 'text-blue-400' : 'text-slate-500'}>-{t.p2Damage}</span>
                      <span className="mx-1 text-slate-400">|</span>
                      <span className="text-slate-500">HP:</span>
                      <span className="text-red-300">{t.p1HpAfter || t.p1Hp}</span>
                      <span className="mx-0.5 text-slate-600">vs</span>
                      <span className="text-blue-300">{t.p2HpAfter || t.p2Hp}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{timelineRounds.length} rounds</div>
              </>
            )}
          </div>
        )}

        {/* Waiting for opponent (initial, before round data) */}
        {waitingForOpponent && !battleState && !battleResult && (
          <div className="mt-3 text-sky-300 text-sm">Waiting for opponent to submit code...</div>
        )}

        <button type="button" className="mt-4 rounded bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400" onClick={() => { setCode(`if (myHealth < 5) return "HEAL";\nif (myEnergy >= 4 && opponentHealth <= 8) return "SPECIAL";\nreturn "ATTACK";`); setWager(0); leaveArenaRoom(); }}>Exit arena</button>
      </div>
    </>
  );
}
