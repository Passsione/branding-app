// services/authService.ts
// =====================================================
// AUTHENTICATION SERVICE
// =====================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User, SUBSCRIPTION_PLANS } from '../types';

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
export const registerWithEmail = async (
  email: string,
  password: string,
  username: string,
  displayName: string
): Promise<FirebaseUser> => {
  // Check username uniqueness
  const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (usernameDoc.exists()) {
    throw new Error('Username already taken');
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;

  await updateProfile(user, { displayName });

  // Create user document
  const userDoc: User = {
    uid: user.uid,
    username: username.toLowerCase(),
    displayName,
    email,
    bio: '',
    avatarUrl: '',
    website: '',
    isVerified: false,
    isPrivate: false,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    subscriptionTier: 'free',
    subscriptionStatus: 'none',
    subscriptionExpiresAt: null,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  // Batch: create user doc + reserve username
  await Promise.all([
    setDoc(doc(db, 'users', user.uid), userDoc),
    setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: user.uid }),
  ]);

  return user;
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
export const loginWithEmail = async (
  email: string,
  password: string
): Promise<FirebaseUser> => {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
};

// ─────────────────────────────────────────────
// GOOGLE SIGN-IN (React Native: use @react-native-google-signin/google-signin)
// ─────────────────────────────────────────────
export const loginWithGoogle = async (idToken: string): Promise<FirebaseUser> => {
  const provider = GoogleAuthProvider.credential(idToken);
  const { user } = await signInWithCredential(auth, provider);

  // Create profile if first login
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) {
    const username = `user_${user.uid.slice(0, 8)}`;
    const newUser: User = {
      uid: user.uid,
      username,
      displayName: user.displayName || '',
      email: user.email || '',
      bio: '',
      avatarUrl: user.photoURL || '',
      website: '',
      isVerified: false,
      isPrivate: false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      subscriptionTier: 'free',
      subscriptionStatus: 'none',
      subscriptionExpiresAt: null,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };
    await Promise.all([
      setDoc(doc(db, 'users', user.uid), newUser),
      setDoc(doc(db, 'usernames', username), { uid: user.uid }),
    ]);
  }
  return user;
};

// ─────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────
export const logout = async (): Promise<void> => {
  await signOut(auth);
};

// ─────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────
export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

// ─────────────────────────────────────────────
// GET CURRENT USER PROFILE
// ─────────────────────────────────────────────
export const getUserProfile = async (uid: string): Promise<User | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
};

// ─────────────────────────────────────────────
// AUTH STATE OBSERVER
// ─────────────────────────────────────────────
export const subscribeToAuthState = (
  callback: (user: FirebaseUser | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};

// ─────────────────────────────────────────────
// DELETE ACCOUNT
// ─────────────────────────────────────────────
export const deleteAccount = async (password: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user logged in');

  // Re-authenticate before deletion
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  // Cloud Function handles cleaning up Firestore data
  // Calling deleteUser will trigger the onUserDeleted Cloud Function
  await deleteUser(user);
};
