'use client';

import { useState } from 'react';
import type { SparkyQuestStage, GameGoal } from '@/components/game/types';

const GOAL_TELEPORT: Record<GameGoal, {
  questStage: SparkyQuestStage;
  money: number;
  backpack: string[];
  workshopIntroSeen: boolean;
  cutsceneDone: boolean;
  batteryInstalled: boolean;
  position: { x: number; y: number; room: string };
}> = {
  'watch-cutscene': {
    questStage: 'intro', money: 0, backpack: [],
    workshopIntroSeen: false, cutsceneDone: false, batteryInstalled: false,
    position: { x: 0, y: -1.5, room: 'apartment' },
  },
  'talk-to-sparky': {
    questStage: 'intro', money: 0, backpack: [],
    workshopIntroSeen: false, cutsceneDone: true, batteryInstalled: false,
    position: { x: 0, y: -7, room: 'outside' },
  },
  'show-letter-to-rafiq': {
    questStage: 'intro', money: 0, backpack: ['letter'],
    workshopIntroSeen: true, cutsceneDone: true, batteryInstalled: false,
    position: { x: -6, y: -10, room: 'outside' },
  },
  'earn-money': {
    questStage: 'unit1-done', money: 0, backpack: [],
    workshopIntroSeen: true, cutsceneDone: true, batteryInstalled: false,
    position: { x: 0, y: -3.7, room: 'workshop' },
  },
  'buy-battery': {
    questStage: 'unit1-done', money: 10, backpack: [],
    workshopIntroSeen: true, cutsceneDone: true, batteryInstalled: false,
    position: { x: 0, y: -7, room: 'outside' },
  },
  'install-battery': {
    questStage: 'unit1-done', money: 10, backpack: ['battery'],
    workshopIntroSeen: true, cutsceneDone: true, batteryInstalled: false,
    position: { x: 0, y: -1.5, room: 'apartment' },
  },
  'free-roam': {
    questStage: 'all-done', money: 10, backpack: [],
    workshopIntroSeen: true, cutsceneDone: true, batteryInstalled: true,
    position: { x: 0, y: -7, room: 'outside' },
  },
};

export default function ModalShell({ activeModal, setActiveModal, userId, debugMode, setDebugMode }: { activeModal: string; setActiveModal: (v: string | null) => void; userId: string; debugMode: boolean; setDebugMode: (v: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setActiveModal(null)}>
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-600/50 shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4 shrink-0">
          <h2 className="text-xl font-bold text-white capitalize">{activeModal}</h2>
          <button onClick={() => setActiveModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors">✕</button>
        </div>
        <div className="p-6 text-slate-300 overflow-y-auto">
          {activeModal === 'settings' && <SettingsModal userId={userId} debugMode={debugMode} setDebugMode={setDebugMode} />}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ userId, debugMode, setDebugMode }: { userId: string; debugMode: boolean; setDebugMode: (v: boolean) => void }) {
  const [selectedGoal, setSelectedGoal] = useState<GameGoal | ''>('');

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    window.location.href = '/login';
  };
  const handleReset = async () => {
    if (!confirm('This will delete all your progress (tutorial, XP, money). Are you sure?')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    const r = await fetch('/api/profile/reset', { method: 'POST' });
    if (r.ok) {
      try { localStorage.removeItem('rb_robot_name'); localStorage.removeItem('rb_first_tx_done'); } catch {}
      alert('Progress reset. Reload to start fresh.'); window.location.reload();
    }
    else { const d = await r.json(); alert(d.error || 'Failed to reset progress.'); }
  };
  const handleGoalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const goal = e.target.value as GameGoal;
    setSelectedGoal(goal);
    const tp = GOAL_TELEPORT[goal];
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questStage: tp.questStage,
          cutsceneDone: tp.cutsceneDone,
          batteryInstalled: tp.batteryInstalled,
          workshopIntroSeen: tp.workshopIntroSeen,
          money: tp.money,
          backpack: tp.backpack,
          position: tp.position,
        }),
      });
    } catch {}
    window.location.reload();
  };
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500" />
        <span className="text-slate-200">Debug Mode (coords &amp; FPS)</span>
      </label>
      {debugMode && (
        <div className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-amber-400 text-sm font-semibold">Debug Tools</p>
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">Teleport to mission</label>
            <select value={selectedGoal} onChange={handleGoalChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm">
              <option value="" disabled>Select mission...</option>
              <option value="watch-cutscene">Watch intro cutscene</option>
              <option value="talk-to-sparky">Talk to Sparky</option>
              <option value="show-letter-to-rafiq">Show letter to Rafiq</option>
              <option value="earn-money">Earn $10 at workshop</option>
              <option value="buy-battery">Buy battery at Parts Shop</option>
              <option value="install-battery">Install battery in apartment</option>
              <option value="free-roam">Free roam (all done)</option>
            </select>
            <p className="text-slate-500 text-xs mt-1.5">Resets all relevant state and teleports you.</p>
          </div>
        </div>
      )}
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm mb-2">Account</p>
        <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-left font-semibold text-white">Log Out</button>
      </div>
      <div className="border-t border-slate-700 pt-4">
        <p className="text-slate-400 text-sm mb-2">Danger Zone</p>
        <button onClick={handleReset} className="w-full px-4 py-3 bg-red-900/50 border border-red-700 hover:bg-red-900 rounded-lg text-left font-semibold text-red-400">Reset Progress</button>
      </div>
    </div>
  );
}
