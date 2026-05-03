import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: null | {
    id: string;
    email: string;
    username: string;
    workos_user_id: string;
  };
  profile: null | {
    robot_name: string;
    robot_model: string;
    level: number;
    xp: number;
    coins: number;
    gems: number;
  };
  isAuthenticated: boolean;
  setUser: (user: AuthState['user']) => void;
  setProfile: (profile: AuthState['profile']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      logout: () => set({ user: null, profile: null, isAuthenticated: false }),
    }),
    { name: 'robocode-auth' }
  )
)
