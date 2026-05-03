import React from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, FontSize } from '../constants/theme';

const LOGO = require('../../assets/logo.png');

import HomeScreen from '../screens/main/HomeScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import ReferralsScreen from '../screens/main/ReferralsScreen';
import MarketScreen from '../screens/main/MarketScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home', component: HomeScreen, icon: 'home', iconOutline: 'home-outline', label: 'Home' },
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
            ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bgCard }]} />
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
              <Ionicons name={iconName as any} size={22} color={color} />
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
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  iconWrapper: {
    width: 40, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: 'rgba(26,86,255,0.12)',
  },
  homeIconWrapper: {
    width: 40, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  homeIconActive: {
    backgroundColor: 'rgba(245,166,35,0.18)',
    borderColor: 'rgba(245,166,35,0.4)',
  },
  homeLogoIcon: { width: 28, height: 28 },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
