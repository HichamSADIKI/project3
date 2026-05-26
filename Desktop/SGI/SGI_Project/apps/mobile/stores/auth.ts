/**
 * Store Zustand — authentification SGI mobile.
 * Persiste le token via expo-secure-store.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync("sgi_token");
      if (token) {
        const res = await authApi.me();
        set({ token, user: res.data as User });
      }
    } catch {
      await SecureStore.deleteItemAsync("sgi_token");
      set({ token: null, user: null });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login(email, password);
      const { access_token } = res.data;
      await SecureStore.setItemAsync("sgi_token", access_token);

      const meRes = await authApi.me();
      set({ token: access_token, user: meRes.data as User, isLoading: false });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "login_failed";
      set({ error: msg, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("sgi_token");
    set({ token: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
