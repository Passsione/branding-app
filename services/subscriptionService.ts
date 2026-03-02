// src/services/subscriptionService.ts
// =====================================================
// SUBSCRIPTION SERVICE
// Supports two integration paths:
//   A) Stripe (web/Android direct billing)
//   B) RevenueCat (iOS/Android in-app purchases — RECOMMENDED for mobile)
// =====================================================

import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../firebase/config';
import { SubscriptionTier, SUBSCRIPTION_PLANS, User } from '../types';

// ─────────────────────────────────────────────
// READ SUBSCRIPTION STATE
// ─────────────────────────────────────────────
export const getSubscription = async (uid?: string): Promise<{
  tier: SubscriptionTier;
  status: User['subscriptionStatus'];
  expiresAt: Date | null;
}> => {
  const userId = uid ?? auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const snap = await getDoc(doc(db, 'subscriptions', userId));
  if (!snap.exists()) {
    return { tier: 'free', status: 'none', expiresAt: null };
  }

  const data = snap.data();
  return {
    tier: data.tier ?? 'free',
    status: data.status ?? 'none',
    expiresAt: data.expiresAt?.toDate() ?? null,
  };
};

// ─────────────────────────────────────────────
// REAL-TIME SUBSCRIPTION LISTENER
// ─────────────────────────────────────────────
export const subscribeToSubscription = (
  callback: (tier: SubscriptionTier, status: User['subscriptionStatus']) => void
): Unsubscribe => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  return onSnapshot(doc(db, 'subscriptions', uid), (snap) => {
    if (snap.exists()) {
      callback(snap.data().tier ?? 'free', snap.data().status ?? 'none');
    } else {
      callback('free', 'none');
    }
  });
};

// ─────────────────────────────────────────────
// CHECK FEATURE ACCESS
// ─────────────────────────────────────────────
export const canUseFeature = async (
  feature: keyof (typeof SUBSCRIPTION_PLANS)['free']['features']
): Promise<boolean> => {
  const { tier } = await getSubscription();
  const plan = SUBSCRIPTION_PLANS[tier];
  const value = plan.features[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === -1 || value > 0;
  return false;
};

// =====================================================
// PATH A: STRIPE INTEGRATION
// =====================================================
// Use for: Web, Android (direct billing, not Play Store)
// Requirements:
//   - Stripe account + products configured
//   - Firebase Extension: "Run Payments with Stripe"
//     https://extensions.dev/extensions/stripe/firestore-stripe-payments
//   - npm install @stripe/stripe-react-native
// =====================================================

export const stripe = {
  /**
   * Create a Stripe Checkout session via Cloud Function.
   * Returns a URL to open in the browser / WebView.
   */
  createCheckoutSession: async (
    tier: SubscriptionTier,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<string> => {
    const createSession = httpsCallable<
      { tier: string; billingPeriod: string },
      { url: string }
    >(functions, 'createStripeCheckoutSession');

    const { data } = await createSession({ tier, billingPeriod });
    return data.url;
  },

  /**
   * Open the Stripe customer portal to manage/cancel subscription.
   */
  openPortal: async (): Promise<string> => {
    const getPortalUrl = httpsCallable<void, { url: string }>(
      functions,
      'createStripePortalSession'
    );
    const { data } = await getPortalUrl();
    return data.url;
  },

  /**
   * Webhook handler (Cloud Function — see functions/stripe.ts):
   * Events to handle:
   *   customer.subscription.created  → set tier, status='active'
   *   customer.subscription.updated  → update tier/status
   *   customer.subscription.deleted  → downgrade to free
   *   invoice.payment_failed          → set status='past_due'
   */
};

// =====================================================
// PATH B: REVENUECAT INTEGRATION (RECOMMENDED for iOS/Android)
// =====================================================
// Use for: iOS App Store, Google Play Store IAP
// Requirements:
//   - RevenueCat account: https://app.revenuecat.com
//   - npm install react-native-purchases
//   - Configure products in App Store Connect + Google Play Console
//   - Add RevenueCat webhook → Firebase Cloud Function
// =====================================================

/**
 * RevenueCat setup — call once at app startup (after Firebase init)
 *
 * import Purchases, { LOG_LEVEL } from 'react-native-purchases';
 *
 * export const initRevenueCat = async (userId: string) => {
 *   Purchases.setLogLevel(LOG_LEVEL.DEBUG);
 *
 *   await Purchases.configure({
 *     apiKey: Platform.OS === 'ios'
 *       ? 'YOUR_REVENUECAT_IOS_KEY'
 *       : 'YOUR_REVENUECAT_ANDROID_KEY',
 *     appUserID: userId,  // Firebase UID as RevenueCat user ID
 *   });
 * };
 */

export const revenueCat = {
  /**
   * Fetch available subscription packages for display.
   *
   * const offerings = await Purchases.getOfferings();
   * const packages = offerings.current?.availablePackages ?? [];
   * // Map packages to your UI
   */
  getOfferings: async () => {
    // Stub — import Purchases from 'react-native-purchases'
    throw new Error('Import react-native-purchases and uncomment implementation');
    /*
    const Purchases = require('react-native-purchases').default;
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
    */
  },

  /**
   * Purchase a package.
   *
   * const { customerInfo } = await Purchases.purchasePackage(pkg);
   * const tier = mapEntitlementToTier(customerInfo.entitlements.active);
   */
  purchasePackage: async (packageToPurchase: any) => {
    // Stub
    throw new Error('Import react-native-purchases and uncomment implementation');
    /*
    const Purchases = require('react-native-purchases').default;
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
    */
  },

  /**
   * Restore purchases (required by App Store guidelines).
   */
  restorePurchases: async () => {
    // Stub
    throw new Error('Import react-native-purchases and uncomment implementation');
    /*
    const Purchases = require('react-native-purchases').default;
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
    */
  },

  /**
   * Map RevenueCat entitlements → app subscription tier.
   * Configure entitlement IDs in RevenueCat dashboard to match these.
   */
  mapEntitlementToTier: (
    activeEntitlements: Record<string, any>
  ): SubscriptionTier => {
    if (activeEntitlements['creator']) return 'creator';
    if (activeEntitlements['pro']) return 'pro';
    if (activeEntitlements['basic']) return 'basic';
    return 'free';
  },

  /**
   * RevenueCat → Firebase sync via webhook (Cloud Function):
   * Configure in RevenueCat Dashboard → Integrations → Firebase
   *
   * Cloud Function 'handleRevenueCatWebhook' receives events:
   *   INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.
   * and updates /subscriptions/{uid} in Firestore.
   */
};

// ─────────────────────────────────────────────
// SUBSCRIPTION PLAN DISPLAY HELPERS
// ─────────────────────────────────────────────
export const formatPrice = (cents: number, period: 'monthly' | 'yearly'): string => {
  if (cents === 0) return 'Free';
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}/${period === 'monthly' ? 'mo' : 'yr'}`;
};

export const getUpgradeMessage = (
  currentTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): string => {
  const plan = SUBSCRIPTION_PLANS[requiredTier];
  return `This feature requires the ${plan.name} plan. Upgrade for $${(plan.priceMonthly / 100).toFixed(2)}/mo.`;
};
