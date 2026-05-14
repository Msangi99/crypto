import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appKit } from '../config/appKit';

interface User {
  id: string;
  walletAddress: string;
  username?: string;
  email?: string;
  avatar?: string;
  referralCode: string;
  createdAt: string;
  pinSetup?: boolean;
  biometricEnabled?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pinVerified: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  setPinVerified: (verified: boolean) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  pinVerified: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('clb_token', token);
    await SecureStore.setItemAsync('clb_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true, pinVerified: !user.pinSetup });
  },

  setPinVerified: (verified) => set({ pinVerified: verified }),

  logout: async () => {
    await SecureStore.deleteItemAsync('clb_token');
    await SecureStore.deleteItemAsync('clb_user');
    try {
      await appKit.disconnect();
    } catch {}
    await AsyncStorage.clear();
    set({ token: null, user: null, isAuthenticated: false, pinVerified: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('clb_token');
      const userStr = await SecureStore.getItemAsync('clb_user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true, isLoading: false, pinVerified: !user.pinSetup });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
