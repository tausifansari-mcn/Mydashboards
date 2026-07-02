import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { useProcessStore } from './processStore';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => {
        useProcessStore.getState().reset();
        set({ accessToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'md-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
