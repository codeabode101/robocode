import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { users, arenaRank, arenaBattles } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { executeCode, resolveSingleTurn } from '@/lib/battleEngine';
import type { Action, PlayerState } from '@/lib/battleEngine';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.WORKOS_API_KEY!));
    return payload.sub as string;
  } catch { return null; }
}

function getRankTier(elo: number): string {
  if (elo >= 1700) return 'diamond';
  if (elo >= 1500) return 'platinum';
  if (elo >= 1300) return 'gold';
  if (elo >= 1100) return 'silver';
  return 'bronze';
}

function calcElo(playerElo: number, opponentElo: number, won: boolean): { newElo: number; delta: number } {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const k = 32;
  const actual = won ? 1 : 0;
  const delta = Math.round(k * (actual - expected));
  return { newElo: Math.max(100, playerElo + delta), delta };
}

async function updateElo(winnerId: string, loserId: string) {
  const wRank = await db.select().from(arenaRank).where(eq(arenaRank.user_id, winnerId)).limit(1).then(r => r[0]);
  const lRank = await db.select().from(arenaRank).where(eq(arenaRank.user_id, loserId)).limit(1).then(r => r[0]);
  const wElo = wRank?.elo ?? 1000;
  const lElo = lRank?.elo ?? 1000;
  const wResult = calcElo(wElo, lElo, true);
  const lResult = calcElo(lElo, wElo, false);

  for (const [uid, elo, won] of [[winnerId, wResult.newElo, true], [loserId, lResult.newElo, false]] as const) {
    await db.insert(arenaRank).values({
      user_id: uid, elo, rank_tier: getRankTier(elo),
      wins: won ? 1 : 0, losses: won ? 0 : 1, battles: 1,
    }).onConflictDoUpdate({
      target: arenaRank.user_id,
      set: {
        elo, rank_tier: getRankTier(elo),
        wins: sql`${arenaRank.wins} + ${won ? 1 : 0}`,
        losses: sql`${arenaRank.losses} + ${won ? 0 : 1}`,
        battles: sql`${arenaRank.battles} + 1`,
        updated_at: new Date(),
      },
    });
  }
  return { p1Delta: wResult.delta, p2Delta: -lResult.delta };
}

function parseRoundHistory(battle: typeof arenaBattles.$inferSelect): any[] {
  if (!battle.round_history) return [];
  try { return JSON.parse(battle.round_history); } catch { return []; }
}

function getLastState(roundHistory: any[]) {
  let p1Hp = 20, p2Hp = 20, p1Energy = 3, p2Energy = 3;
  for (const r of roundHistory) {
    if (r.p1HpAfter !== undefined) p1Hp = r.p1HpAfter;
    if (r.p2HpAfter !== undefined) p2Hp = r.p2HpAfter;
    if (r.p1EnergyAfter !== undefined) p1Energy = r.p1EnergyAfter;
    if (r.p2EnergyAfter !== undefined) p2Energy = r.p2EnergyAfter;
  }
  return { p1Hp, p2Hp, p1Energy, p2Energy };
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, opponentId, code, battleId, wager } = await request.json();

  try {
    if (action === 'start') {
      if (!opponentId) return NextResponse.json({ error: 'Missing opponentId' }, { status: 400 });
      const wagerAmount = Math.max(0, Math.min(1000, wager || 0));
      const userRow = await db.select({ currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
      if (!userRow) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      if (wagerAmount > 0 && userRow.currency < wagerAmount) return NextResponse.json({ error: 'Not enough money' }, { status: 400 });

      const existing = await db.select({ id: arenaBattles.id, status: arenaBattles.status }).from(arenaBattles)
        .where(and(
          eq(arenaBattles.challenger_id, userId),
          eq(arenaBattles.opponent_id, opponentId),
          eq(arenaBattles.status, 'pending'),
        )).limit(1).then(r => r[0]);
      if (existing) return NextResponse.json({ ok: true, battleId: existing.id });

      const inserted = await db.insert(arenaBattles).values({
        challenger_id: userId, opponent_id: opponentId,
        status: 'pending', wager: wagerAmount,
        current_turn: userId,
        round_number: 0,
        p1_time_bank_ms: 240000,
        p2_time_bank_ms: 240000,
      }).returning({ id: arenaBattles.id });

      let bid = inserted?.[0]?.id;
      if (!bid) {
        const rows = await db.select({ id: arenaBattles.id }).from(arenaBattles)
          .where(and(
            eq(arenaBattles.challenger_id, userId),
            eq(arenaBattles.opponent_id, opponentId),
            eq(arenaBattles.status, 'pending'),
          ))
          .orderBy(sql`created_at DESC`).limit(1);
        bid = rows[0]?.id;
      }
      return NextResponse.json({ ok: true, battleId: bid });
    }

    if (action === 'submit-turn') {
      if (!battleId) return NextResponse.json({ error: 'Missing battleId' }, { status: 400 });
      if (!code || !code.trim()) return NextResponse.json({ error: 'Code is empty' }, { status: 400 });

      const battle = await db.select().from(arenaBattles).where(eq(arenaBattles.id, battleId)).limit(1).then(r => r[0]);
      if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
      if (battle.status !== 'pending' && battle.status !== 'active') return NextResponse.json({ error: 'Battle already ended' }, { status: 400 });

      const isChallenger = battle.challenger_id === userId;
      const isOpponent = battle.opponent_id === userId;
      if (!isChallenger && !isOpponent) return NextResponse.json({ error: 'Not your battle' }, { status: 403 });
      if (battle.current_turn !== userId) return NextResponse.json({ error: 'Not your turn' }, { status: 400 });

      const log = battle.battle_log ? JSON.parse(battle.battle_log) : {};
      const roundHistory = parseRoundHistory(battle);
      const { p1Hp, p2Hp, p1Energy, p2Energy } = getLastState(roundHistory);
      const turnNum = (battle.round_number || 0) + 1;
      const lastRound = roundHistory[roundHistory.length - 1];
      const isChallengerTurn = battle.current_turn === battle.challenger_id;

      const stateVars = {
        myHealth: isChallenger ? p1Hp : p2Hp,
        myMaxHealth: 20,
        myEnergy: isChallenger ? p1Energy : p2Energy,
        myMaxEnergy: 5,
        opponentHealth: isChallenger ? p2Hp : p1Hp,
        opponentMaxHealth: 20,
        opponentEnergy: isChallenger ? p2Energy : p1Energy,
        lastMyAction: isChallenger ? (lastRound?.p1Action || 'NONE') : (lastRound?.p2Action || 'NONE'),
        lastOpponentAction: isChallenger ? (lastRound?.p2Action || 'NONE') : (lastRound?.p1Action || 'NONE'),
        round: turnNum,
      };

      const actionStr = executeCode(code, stateVars);
      const validAction = actionStr.toUpperCase() as Action;

      const now = Date.now();
      const turnStart = log.turnStart || now;
      const elapsed = now - turnStart;
      if (isChallenger) {
        log.p1TimeRemaining = (log.p1TimeRemaining ?? 240000) - elapsed;
      } else {
        log.p2TimeRemaining = (log.p2TimeRemaining ?? 240000) - elapsed;
      }
      const p1TimeBank = Math.max(0, isChallenger ? log.p1TimeRemaining : (log.p1TimeRemaining ?? 240000));
      const p2TimeBank = Math.max(0, isOpponent ? log.p2TimeRemaining : (log.p2TimeRemaining ?? 240000));

      if (isChallengerTurn) {
        log.p1Turn = { action: validAction, submitted: true };
      } else {
        log.p2Turn = { action: validAction, submitted: true };
      }

      // If both have submitted, resolve the turn
      if (log.p1Turn?.submitted && log.p2Turn?.submitted) {
        const p1: PlayerState = { hp: p1Hp, maxHp: 20, energy: p1Energy, maxEnergy: 5, lastAction: null };
        const p2: PlayerState = { hp: p2Hp, maxHp: 20, energy: p2Energy, maxEnergy: 5, lastAction: null };
        const result = resolveSingleTurn(p1, p2, log.p1Turn.action, log.p2Turn.action);

        roundHistory.push({
          round: turnNum,
          p1Action: log.p1Turn.action,
          p2Action: log.p2Turn.action,
          p1Damage: result.p1Damage,
          p2Damage: result.p2Damage,
          p1HpAfter: p1.hp,
          p2HpAfter: p2.hp,
          p1EnergyAfter: p1.energy,
          p2EnergyAfter: p2.energy,
          message: result.message,
        });

        // check for game over
        let winnerId: string | null = null;
        if (p1.hp <= 0 && p2.hp <= 0) winnerId = '__draw__';
        else if (p2.hp <= 0) winnerId = battle.challenger_id;
        else if (p1.hp <= 0) winnerId = battle.opponent_id;

        if (winnerId) {
          let resolvedResult: any = { resolved: true, turn: turnNum };
          if (winnerId === '__draw__') {
            await db.update(arenaBattles).set({
              status: 'completed', round_number: turnNum,
              round_history: JSON.stringify(roundHistory),
              battle_log: '{}', current_turn: null,
              completed_at: new Date(),
            }).where(eq(arenaBattles.id, battleId));
            resolvedResult.draw = true;
            resolvedResult.message = 'Draw! Both fell.';
          } else {
            if (battle.wager > 0) {
              await db.update(users).set({ currency: sql`currency + ${battle.wager * 2}` }).where(eq(users.id, winnerId));
            }
            const eloResult = await updateElo(winnerId, winnerId === battle.challenger_id ? battle.opponent_id : battle.challenger_id);
            await db.update(arenaBattles).set({
              status: 'completed', winner_id: winnerId,
              round_number: turnNum,
              round_history: JSON.stringify(roundHistory),
              battle_log: '{}', current_turn: null,
              completed_at: new Date(),
            }).where(eq(arenaBattles.id, battleId));
            resolvedResult.winnerId = winnerId;
            resolvedResult.userWon = winnerId === userId;
            resolvedResult.message = `${winnerId === userId ? 'You' : 'Opponent'} won!`;
          }

          return NextResponse.json({
            ok: true, action: validAction, resolved: resolvedResult,
            result: { p1Damage: result.p1Damage, p2Damage: result.p2Damage, message: result.message },
            turn: turnNum,
            gameOver: true,
          });
        } else {
          // next round — P1 goes again
          const nextP1Time = Math.max(0, p1TimeBank);
          const nextP2Time = Math.max(0, p2TimeBank);
          await db.update(arenaBattles).set({
            round_number: turnNum,
            round_history: JSON.stringify(roundHistory),
            battle_log: JSON.stringify({
              p1TimeRemaining: nextP1Time,
              p2TimeRemaining: nextP2Time,
              turnStart: Date.now(),
            }),
            current_turn: battle.challenger_id,
            status: 'active',
          }).where(eq(arenaBattles.id, battleId));

          return NextResponse.json({
            ok: true, action: validAction,
            resolved: { resolved: true, turn: turnNum, nextTurn: battle.challenger_id },
            result: { p1Damage: result.p1Damage, p2Damage: result.p2Damage, message: result.message },
            turn: turnNum,
            gameOver: false,
            p1TimeBank: nextP1Time,
            p2TimeBank: nextP2Time,
          });
        }
      } else {
        // only one submitted — move to opponent's turn
        const nextTurn = isChallengerTurn ? battle.opponent_id : battle.challenger_id;
        await db.update(arenaBattles).set({
          battle_log: JSON.stringify({
            p1Turn: log.p1Turn || null,
            p2Turn: log.p2Turn || null,
            p1TimeRemaining: p1TimeBank,
            p2TimeRemaining: p2TimeBank,
            turnStart: Date.now(),
          }),
          current_turn: nextTurn,
          status: 'active',
        }).where(eq(arenaBattles.id, battleId));

        return NextResponse.json({
          ok: true, action: validAction,
          resolved: null,
          turn: turnNum,
          gameOver: false,
        });
      }
    }

    if (action === 'status') {
      if (!battleId) return NextResponse.json({ error: 'Missing battleId' }, { status: 400 });
      const battle = await db.select().from(arenaBattles).where(eq(arenaBattles.id, battleId)).limit(1).then(r => r[0]);
      if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 });

      const log = battle.battle_log ? JSON.parse(battle.battle_log) : {};
      const roundHistory = parseRoundHistory(battle);
      const { p1Hp, p2Hp, p1Energy, p2Energy } = getLastState(roundHistory);
      const isChallenger = userId === battle.challenger_id;

      let myTurn = battle.current_turn === userId;
      let revealedAction: string | null = null;

      // reveal opponent's action if they've submitted and it's now my turn
      if (log.p1Turn?.submitted && isChallenger && !log.p2Turn?.submitted) {
        // opponent (P2) has submitted? No, P1 is challenger, so if P1 submitted and P2 hasn't:
        // Actually: if it's my turn (I'm challenger) and P1 hasn't submitted but it says myTurn...
        // Let me think differently:
        // If I'm the challenger and it's my turn, I need to see P2's action if P2 has submitted
        // If I'm the opponent and it's my turn, I need to see P1's action if P1 has submitted
        if (log.p2Turn?.submitted) revealedAction = log.p2Turn.action;
      } else if (log.p2Turn?.submitted && !isChallenger && !log.p1Turn?.submitted) {
        if (log.p1Turn?.submitted) revealedAction = log.p1Turn.action;
      } else if (isChallenger && log.p1Turn?.submitted) {
        revealedAction = log.p1Turn.action;
      } else if (!isChallenger && log.p2Turn?.submitted) {
        revealedAction = log.p2Turn.action;
      }

      const p1TimeRemaining = log.p1TimeRemaining ?? 240000;
      const p2TimeRemaining = log.p2TimeRemaining ?? 240000;

      return NextResponse.json({
        battle: {
          id: battle.id,
          status: battle.status,
          wager: battle.wager,
          winnerId: battle.winner_id,
          roundNumber: battle.round_number || 0,
          currentTurn: battle.current_turn,
          myTurn,
          p1Hp, p2Hp, p1Energy, p2Energy,
          p1TimeBank: p1TimeRemaining,
          p2TimeBank: p2TimeRemaining,
          challengerId: battle.challenger_id,
          opponentId: battle.opponent_id,
          roundHistory,
          iSubmitted: isChallenger ? !!log.p1Turn?.submitted : !!log.p2Turn?.submitted,
          submitted: { p1: !!log.p1Turn?.submitted, p2: !!log.p2Turn?.submitted },
          revealedAction,
          lastTurnResult: roundHistory[roundHistory.length - 1] || null,
        },
      });
    }

    if (action === 'rank') {
      const rank = await db.select().from(arenaRank).where(eq(arenaRank.user_id, userId)).limit(1).then(r => r[0]);
      return NextResponse.json({
        rank: rank || { elo: 1000, rank_tier: 'bronze', wins: 0, losses: 0, battles: 0 },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
