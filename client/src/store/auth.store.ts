import { create } from 'zustand';

type User = { id: string; name: string; email: string; role?: string; status?: string };

type AuthState = {
  user: User | null;
  accessToken: string | null;
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => {
    set({ user, accessToken });
  },
  clearSession: () => {
    set({ user: null, accessToken: null });
  },
}));
