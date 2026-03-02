// src/firebase/config.ts
// =====================================================
// FIREBASE CONFIGURATION
// Replace these values with your Firebase project config
// from: Firebase Console → Project Settings → Your Apps
// =====================================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',
};



// Prevent re-initialization in React Native hot reload
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export default app;

// =====================================================
// REQUIRED NPM PACKAGES:
//   npm install firebase
//   npm install @react-native-firebase/app (optional native SDK)
//   npm install @react-native-firebase/auth
//   npm install @react-native-firebase/firestore
//   npm install @react-native-firebase/storage
//   npm install @react-native-firebase/functions
//
// For payments (subscriptions):
//   npm install @stripe/stripe-react-native
//   npm install react-native-purchases (RevenueCat)
// =====================================================
