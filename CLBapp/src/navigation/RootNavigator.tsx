import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import SplashScreen from '../screens/auth/SplashScreen';
import ConnectWalletScreen from '../screens/auth/ConnectWalletScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import PinVerifyScreen from '../screens/auth/PinVerifyScreen';
import TabNavigator from './TabNavigator';
import ActivityScreen from '../screens/main/ActivityScreen';
import PositionDetailScreen from '../screens/main/PositionDetailScreen';
import CalculatorScreen from '../screens/main/CalculatorScreen';
import ReceiptsScreen from '../screens/main/ReceiptsScreen';
import PoolDetailScreen from '../screens/main/PoolDetailScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import { Colors } from '../constants/theme';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, loadFromStorage, user, pinVerified, setPinVerified, logout } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Register global auth expiry callback
  useEffect(() => {
    globalThis.__CLB_AUTH_EXPIRED__ = (msg?: string) => {
      logout();
      Alert.alert(
        'Session Expired',
        msg || 'Your session has expired. Please log in again.',
        [{ text: 'OK' }]
      );
    };
    return () => { globalThis.__CLB_AUTH_EXPIRED__ = undefined; };
  }, [logout]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (isLoading) {
    return null;
  }

  const needsPinSetup = isAuthenticated && user && !user.pinSetup;
  const needsPinVerify = isAuthenticated && user && user.pinSetup && !pinVerified;

  return (
    <NavigationContainer theme={{
      dark: true,
      colors: {
        primary: Colors.primary,
        background: Colors.bg,
        card: Colors.bgCard,
        text: Colors.textPrimary,
        border: Colors.border,
        notification: Colors.error,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' },
        medium: { fontFamily: 'System', fontWeight: '500' },
        bold: { fontFamily: 'System', fontWeight: '700' },
        heavy: { fontFamily: 'System', fontWeight: '900' },
      },
    }}>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: Colors.bg } }}>
        {!isAuthenticated ? (
          <Stack.Screen name="ConnectWallet" component={ConnectWalletScreen} />
        ) : needsPinSetup ? (
          <Stack.Screen name="PinSetup" component={PinSetupScreen} />
        ) : needsPinVerify ? (
          <Stack.Screen name="PinVerify">
            {() => <PinVerifyScreen onVerified={() => setPinVerified(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="PoolDetail" component={PoolDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Activity" component={ActivityScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: Colors.bgCard }, headerTintColor: Colors.textPrimary, headerTitle: 'Activity' }}
            />
            <Stack.Screen name="PositionDetail" component={PositionDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Calculator" component={CalculatorScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: Colors.bgCard }, headerTintColor: Colors.textPrimary, headerTitle: 'Calculator' }}
            />
            <Stack.Screen name="Receipts" component={ReceiptsScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: Colors.bgCard }, headerTintColor: Colors.textPrimary, headerTitle: 'Receipt Tokens' }}
            />
            <Stack.Screen name="Notifications" component={NotificationsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
