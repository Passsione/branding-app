// ============================================================
// app/(tabs)/_layout.tsx
// Auth-gated tab navigator — all five screens wired.
//
// Tabs:
//   Feed     → FeedScreen + BrandScreen (native stack per-tab)
//   Explore  → ExploreScreen + BrandScreen (native stack per-tab)
//   Premium  → SubscriptionScreen
//   Profile  → ProfileScreen (edit, settings, sign-out)
//   Admin    → AdminDashboard (admin UID only)
// ============================================================

import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets }          from 'react-native-safe-area-context';

import { useAuth }    from '../../hooks/index';
import { useIsAdmin } from '../../hooks/brandHooks';
import { Brand }      from '../../services/brandService';

import { AuthScreen }                          from '../screens/AuthScreen';
import FeedScreen, { BrandScreen,
         SubscriptionScreen }                  from '../screens/FeedAndSubscriptionScreens';
import ExploreScreen                           from '../screens/ExploreScreen';
import ProfileScreen                           from '../screens/ProfileScreen';
import AdminDashboard                          from '../screens/AdminDashboard';

const Tab         = createBottomTabNavigator();
const FeedNav     = createNativeStackNavigator();
const ExploreNav  = createNativeStackNavigator();
const { width: SW } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:         '#0d0806',
  surface:    '#120a07',
  border:     '#2e1a0e',
  text:       '#f5ede6',
  sub:        '#9e7e6a',
  muted:      '#4a3328',
  primary:    '#9B5035',
  primaryDk:  '#7D3F2A',
  gold:       '#C8901A',
  goldLt:     '#E8A820',
};

// ── Custom tab bar ─────────────────────────────────────────────
interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TAB_ICONS: Record<string, { icon: string; activeIcon: string; label: string }> = {
  feed:    { icon: '⊟',  activeIcon: '⊞',  label: 'Feed'    },
  explore: { icon: '⌕',  activeIcon: '⌕',  label: 'Explore' },
  premium: { icon: '◇',  activeIcon: '◆',  label: 'Premium' },
  profile: { icon: '○',  activeIcon: '●',  label: 'Profile' },
  admin:   { icon: '⚙',  activeIcon: '⚙',  label: 'Admin'   },
};

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets  = useSafeAreaInsets();
  const isAdmin = useIsAdmin();

  return (
    <View style={[tb.bar, { paddingBottom: insets.bottom || 12 }]}>
      {/* Blur-style separator */}
      <View style={tb.separator} />

      <View style={tb.inner}>
        {state.routes.map((route: any, index: number) => {
          const { options }  = descriptors[route.key];
          const isFocused    = state.index === index;
          const name         = route.name.toLowerCase();
          const meta         = TAB_ICONS[name] ?? { icon: '○', activeIcon: '●', label: name };
          const isAdminTab   = name === 'admin';

          // Hide admin tab from non-admins
          if (isAdminTab && !isAdmin) return null;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={tb.tab}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {/* Active indicator pill */}
              {isFocused && (
                <View style={[
                  tb.activePill,
                  isAdminTab && { backgroundColor: '#1a2f27', borderColor: '#00e5b0' },
                  name === 'premium' && { backgroundColor: C.primaryDk + '60', borderColor: C.gold },
                ]} />
              )}

              {/* Icon */}
              <Text style={[
                tb.icon,
                isFocused && tb.iconActive,
                name === 'premium' && isFocused && { color: C.gold },
                isAdminTab && isFocused && { color: '#00e5b0' },
              ]}>
                {isFocused ? meta.activeIcon : meta.icon}
              </Text>

              {/* Label */}
              <Text style={[
                tb.label,
                isFocused && tb.labelActive,
                name === 'premium' && isFocused && { color: C.gold },
                isAdminTab && isFocused && { color: '#00e5b0' },
              ]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  bar:        { backgroundColor: C.bg, position: 'absolute', bottom: 0, left: 0, right: 0 },
  separator:  { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
  inner:      { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8 },
  tab:        { flex: 1, alignItems: 'center', position: 'relative', paddingVertical: 4 },
  activePill: { position: 'absolute', top: -2, width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryDk + '50', borderWidth: 1, borderColor: C.primary + '60' },
  icon:       { fontSize: 19, color: C.muted },
  iconActive: { color: C.primary },
  label:      { fontSize: 9, color: C.muted, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },
  labelActive:{ color: C.primary },
});

// ── Screens for FeedNav stack ─────────────────────────────────
// We wrap them so we can inject navigation callbacks without
// cluttering the navigator config.

function FeedHome({ navigation }: { navigation: any }) {
  const goToBrand = useCallback(
    (brand: Brand) => navigation.push('BrandFromFeed', { brand }),
    [navigation],
  );
  const goToPremium = useCallback(
    () => navigation.getParent()?.navigate('Premium'),
    [navigation],
  );
  return (
    <FeedScreen
      onNavigateToBrand={goToBrand}
      onNavigateToSubscription={goToPremium}
    />
  );
}

function BrandFromFeed({ route, navigation }: { route: any; navigation: any }) {
  return (
    <BrandScreen
      brand={route.params.brand}
      onBack={() => navigation.goBack()}
    />
  );
}

// ── Feed tab stack ─────────────────────────────────────────────
function FeedStack() {
  return (
    <FeedNav.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <FeedNav.Screen name="FeedHome"     component={FeedHome}     />
      <FeedNav.Screen name="BrandFromFeed" component={BrandFromFeed} />
    </FeedNav.Navigator>
  );
}

// ── Screens for ExploreNav stack ──────────────────────────────

function ExploreHome({ navigation }: { navigation: any }) {
  const goToBrand = useCallback(
    (brand: Brand) => navigation.push('BrandFromExplore', { brand }),
    [navigation],
  );
  return <ExploreScreen onNavigateToBrand={goToBrand} />;
}

function BrandFromExplore({ route, navigation }: { route: any; navigation: any }) {
  return (
    <BrandScreen
      brand={route.params.brand}
      onBack={() => navigation.goBack()}
    />
  );
}

// ── Explore tab stack ──────────────────────────────────────────
function ExploreStack() {
  return (
    <ExploreNav.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ExploreNav.Screen name="ExploreHome"      component={ExploreHome}      />
      <ExploreNav.Screen name="BrandFromExplore" component={BrandFromExplore} />
    </ExploreNav.Navigator>
  );
}

// ── Profile screen wrapper (passes goToPremium) ──────────────
function ProfileTab({ navigation }: { navigation: any }) {
  return <ProfileScreen onGoToPremium={() => navigation.navigate('Premium')} />;
}

// ── Loading screen ────────────────────────────────────────────
function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: C.gold, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Brand.co</Text>
      <ActivityIndicator color={C.gold} />
    </View>
  );
}

// ── Root layout ───────────────────────────────────────────────
export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  const isAdmin = useIsAdmin();

  if (loading)          return <LoadingScreen />;
  if (!isAuthenticated) return <AuthScreen />;

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="Feed"
    >
      <Tab.Screen name="Feed"    component={FeedStack}    />
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Premium" component={SubscriptionScreen} />
      <Tab.Screen name="Profile" component={ProfileTab}   />
      {/* Admin tab — always registered, guard is inside AdminDashboard + CustomTabBar hides the tab */}
      {isAdmin && <Tab.Screen name="Admin"   component={AdminDashboard} />}
    </Tab.Navigator>
  );
}
