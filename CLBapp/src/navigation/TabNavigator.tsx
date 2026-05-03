import React from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, FontSize, Spacing } from '../constants/theme';

const LOGO = require('../../assets/logo.png');

import HomeScreen from '../screens/main/HomeScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import PoolsScreen from '../screens/main/PoolsScreen';
import ReferralsScreen from '../screens/main/ReferralsScreen';
import MarketScreen from '../screens/main/MarketScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home', component: HomeScreen, icon: 'home', iconOutline: 'home-outline', label: 'Home' },
  { name: 'Pools', component: PoolsScreen, icon: 'water', iconOutline: 'water-outline', label: 'Pools' },
  { name: 'Portfolio', component: PortfolioScreen, icon: 'briefcase', iconOutline: 'briefcase-outline', label: 'Portfolio' },
  { name: 'Market', component: MarketScreen, icon: 'stats-chart', iconOutline: 'stats-chart-outline', label: 'Market' },
  { name: 'Referrals', component: ReferralsScreen, icon: 'people', iconOutline: 'people-outline', label: 'Referrals' },
  { name: 'Profile', component: ProfileScreen, icon: 'person', iconOutline: 'person-outline', label: 'Profile' },
];

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          Platform.OS === 'ios'
            ? <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,14,26,0.95)' }]} />
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (route.name === 'Home') {
            return (
              <View style={[styles.homeIconWrapper, focused && styles.homeIconActive]}>
                <Image source={LOGO} style={styles.homeLogoIcon} resizeMode="contain" />
              </View>
            );
          }
          const iconName = focused ? tab?.icon : tab?.iconOutline;
          return (
            <View style={[styles.iconWrapper, focused && styles.iconActive]}>
              {focused ? (
                <LinearGradient colors={Colors.gradientPrimary} style={styles.iconGradient}>
                  <Ionicons name={iconName as any} size={24} color="#fff" />
                </LinearGradient>
              ) : (
                <Ionicons name={iconName as any} size={24} color={color} />
              )}
            </View>
          );
        },
      })}
    >
      {TABS.map((tab) => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={{ tabBarLabel: tab.label }} />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    height: Platform.OS === 'ios' ? 90 : 75,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'transparent',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    marginHorizontal: Spacing.md,
    marginBottom: Platform.OS === 'ios' ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  iconActive: {
    transform: [{ scale: 1.1 }],
  },
  iconGradient: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  homeIconWrapper: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(240,185,11,0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  homeIconActive: {
    backgroundColor: 'rgba(240,185,11,0.2)',
    borderColor: Colors.primary,
    transform: [{ scale: 1.1 }],
  },
  homeLogoIcon: { width: 32, height: 32 },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});
