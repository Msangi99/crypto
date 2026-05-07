import './src/config/appKit';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { appKit, wagmiAdapter } from './src/config/appKit';

const queryClient = new QueryClient();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppKitProvider instance={appKit}>
          <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <StatusBar style="light" backgroundColor="#0B0E1A" />
              <RootNavigator />
              <AppKit />
            </QueryClientProvider>
          </WagmiProvider>
        </AppKitProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
