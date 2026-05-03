import { create } from 'zustand'

interface PlayerState {
  robotName: string;
  robotModel: 'robo_pup' | 'circuit_cat' | 'pixel_dragon';
  level: number;
  xp: number;
  coins: number;
  gems: number;
  battleWins: number;
  battleLosses: number;
  storyChapter: number;
  storyQuest: number;
  streakDays: number;
  setRobot: (name: string, model: PlayerState['robotModel']) => void;
  addCoins: (amount: number) => void;
  addXP: (amount: number) => void;
  recordBattle: (won: boolean) => void;
  nextQuest: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  robotName: '',
  robotModel: 'robo_pup',
  level: 1,
  xp: 0,
  coins: 100,
  gems: 0,
  battleWins: 0,
  battleLosses: 0,
  storyChapter: 1,
  storyQuest: 1,
  streakDays: 0,
  setRobot: (name, model) => set({ robotName: name, robotModel: model }),
  addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
  addXP: (amount) => set((state) => {
    const newXP = state.xp + amount;
    const newLevel = Math.floor(newXP / 500) + 1;
    return { xp: newXP, level: newLevel };
  }),
  recordBattle: (won) => set((state) => ({
    battleWins: won ? state.battleWins + 1 : state.battleWins,
    battleLosses: won ? state.battleLosses : state.battleLosses + 1,
  })),
  nextQuest: () => set((state) => {
    if (state.storyQuest < 5) {
      return { storyQuest: state.storyQuest + 1 };
    }
    return { storyChapter: state.storyChapter + 1, storyQuest: 1 };
  }),
}))
