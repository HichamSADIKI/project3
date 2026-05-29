/**
 * Store Zustand — authentification SGI mobile.
 * Persiste le token via expo-secure-store.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { authApi, type SocialLoginPayload, type SocialProvider } from "@/lib/api";

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
  /** Faux tant que l'avertissement de session n'a pas été acquitté pour la session courante. */
  sessionWarningShown: boolean;

  login: (email: string, password: string) => Promise<void>;
  socialLogin: (payload: SocialLoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  clearError: () => void;
  acknowledgeSessionWarning: () => void;
}

export type { SocialProvider };

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,
  sessionWarningShown: false,

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync("sgi_token");
      if (token) {
        const res = await authApi.me();
        set({ token, user: res.data as User, sessionWarningShown: false });
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
      set({
        token: access_token,
        user: meRes.data as User,
        isLoading: false,
        sessionWarningShown: false,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "login_failed";
      set({ error: msg, isLoading: false });
    }
  },

  socialLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.social(payload);
      const { access_token } = res.data;
      await SecureStore.setItemAsync("sgi_token", access_token);

      const meRes = await authApi.me();
      set({
        token: access_token,
        user: meRes.data as User,
        isLoading: false,
        sessionWarningShown: false,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "social_login_failed";
      set({ error: msg, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("sgi_token");
    set({ token: null, user: null, sessionWarningShown: false });
  },

  clearError: () => set({ error: null }),

  acknowledgeSessionWarning: () => set({ sessionWarningShown: true }),
}));
