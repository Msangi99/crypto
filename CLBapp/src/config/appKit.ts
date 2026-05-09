/**
 * AppKit / WalletConnect bootstrap for the CLB mobile app.
 *
 * NOTE: `@walletconnect/react-native-compat` MUST be the very first import in
 * this file (and in any entry that touches AppKit) to install the polyfills
 * that WalletConnect needs in a React Native environment.
 */
import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';
import { bsc } from 'wagmi/chains';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { dappMetadata, WALLETCONNECT_PROJECT_ID } from './dapp';

if (!WALLETCONNECT_PROJECT_ID) {
  // eslint-disable-next-line no-console
  console.warn(
    '[AppKit] WALLETCONNECT_PROJECT_ID is empty. ' +
      'Get a project id from https://cloud.reown.com and set it in src/config/dapp.ts.',
  );
}

/** Networks the dApp supports. CLB is a BSC-only product today. */
export const supportedNetworks = [bsc] as const;

/**
 * Wagmi adapter — exposes the wagmi config used by `WagmiProvider` and any
 * wagmi hooks (`useAccount`, `useSignMessage`, …) inside the app.
 */
export const wagmiAdapter = new WagmiAdapter({
  projectId: WALLETCONNECT_PROJECT_ID,
  networks: [...supportedNetworks],
});

/**
 * Single AppKit instance for the whole app. Created once at module load so
 * the `<AppKitProvider instance={appKit}>` mount in `App.tsx` is stable.
 */
export const appKit = createAppKit({
  projectId: WALLETCONNECT_PROJECT_ID,
  metadata: dappMetadata,
  networks: [...supportedNetworks],
  defaultNetwork: bsc,
  adapters: [wagmiAdapter],
  storage: {
    getItem: async <T = any>(key: string) => {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    },
    setItem: async <T = any>(key: string, value: T) => {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    },
    getKeys: async () => {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    },
    getEntries: async <T = any>() => {
      const keys = await AsyncStorage.getAllKeys();
      const rows = await AsyncStorage.multiGet(keys);
      return rows.flatMap(([key, raw]) => {
        if (raw == null) return [];
        try {
          return [[key, JSON.parse(raw) as T] as [string, T]];
        } catch {
          return [[key, raw as T] as [string, T]];
        }
      });
    },
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  },
  clipboardClient: {
    setString: async (value: string) => {
      await Clipboard.setStringAsync(value);
    },
  },
});

export { dappMetadata };
