// ============================================================
// _layout.tsx  —  Root entry point with bottom tab navigation
//
// Install: npm install @react-navigation/native @react-navigation/bottom-tabs
//          react-native-screens react-native-safe-area-context
//          react-native-linear-gradient
// ============================================================

import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedScreen, SubscriptionScreen } from '../screens/FeedAndSubscriptionScreens';

const Tab = createBottomTabNavigator();

const C = {
  bg: '#0a0a0a', border: '#1c1c1c', text: '#f2f2f2', muted: '#444',
};

// ── Placeholder screens ────────────────────────────────────
const ExploreScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>🔍</Text>
    <Text style={styles.placeholderText}>Explore</Text>
  </View>
);
const ProfileScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>👤</Text>
    <Text style={styles.placeholderText}>Profile</Text>
  </View>
);

// ── Tab icons (swap for react-native-vector-icons in prod) ──
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
);

export default function App() {
  return (
    <SafeAreaProvider>
      {/* <NavigationContainer> */}
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: 'rgba(10,10,10,0.97)',
              borderTopColor: C.border,
              borderTopWidth: 1,
              height: Platform.OS === 'ios' ? 82 : 64,
              paddingBottom: Platform.OS === 'ios' ? 24 : 10,
              paddingTop: 8,
            },
            tabBarActiveTintColor: C.text,
            tabBarInactiveTintColor: C.muted,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
          }}
        >
          <Tab.Screen
            name="Feed"
            children={({ navigation }) => (
              <FeedScreen onNavigateToSubscription={() => navigation.navigate('Premium')} />
            )}
            options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
          />
          <Tab.Screen
            name="Explore"
            component={ExploreScreen}
            options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }}
          />
          <Tab.Screen
            name="Premium"
            component={SubscriptionScreen}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon emoji="👑" focused={focused} />,
              tabBarLabel: 'Premium',
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
          />
        </Tab.Navigator>
      {/* </NavigationContainer> */}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1, backgroundColor: '#0a0a0a',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  placeholderIcon: { fontSize: 48, opacity: 0.3 },
  placeholderText: { fontSize: 15, color: C.muted },
});
