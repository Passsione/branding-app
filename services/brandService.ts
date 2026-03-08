// services/brandService.ts
// =====================================================
// BRAND SERVICE — Firestore CRUD
// Only admin UID can create / update / delete brands.
// All users can read brands + subscribe.
// =====================================================

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  deleteDoc, query, orderBy, limit, where, onSnapshot,
  serverTimestamp, increment, Unsubscribe, setDoc,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  initializeApp,
  getApps,
  deleteApp,
  FirebaseApp,
} from 'firebase/app';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import app, { db, storage,  auth } from '../firebase/config';

// ── Admin gate ────────────────────────────────────────────────
// Store your admin UID in an env var or hardcode for now.
// In production use Firebase Custom Claims instead.
export const ADMIN_UID = process.env.EXPO_PUBLIC_ADMIN_UID ?? 'REPLACE_WITH_YOUR_ADMIN_UID';

export const assertAdmin = () => {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    throw new Error('Unauthorized: admin only');
  }
};

// ── Brand type (Firestore shape) ──────────────────────────────
export interface Brand {
  id: string;
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  logoUrl: string;
  coverUrl: string;
  primaryColor: string;
  secondaryColor: string;
  category: string;
  website: string | null;
  fonts: string[];
  isVerified: boolean;
  isLive: boolean;
  liveViewers: number;
  status: 'active' | 'suspended' | 'pending';
  plan: 'free' | 'basic' | 'pro' | 'creator';
  flagged: boolean;
  subscribersCount: number;
  postsCount: number;
  revenue: number;         // monthly in USD
  ownerUid: string | null; // uid of brand owner (non-admin), null = admin-owned
  createdAt: any;
  updatedAt: any;
}

// ── Upload media helper ───────────────────────────────────────
export const uploadBrandMedia = (
  uri: string,
  fileName: string,
  onProgress?: (p: number) => void,
): Promise<string> =>
  new Promise(async (resolve, reject) => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const storageRef = ref(storage, `brands/${Date.now()}_${fileName}`);
    const task = uploadBytesResumable(storageRef, blob);
    task.on(
      'state_changed',
      snap => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });


  
// // ── CREATE brand (admin only) ─────────────────────────────────
// export const createBrand = async (
//   data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'subscribersCount' | 'postsCount' | 'liveViewers'>,
// ): Promise<string> => {
//   assertAdmin();
//   const ref = await addDoc(collection(db, 'brands'), {
//     ...data,
//     subscribersCount: 0,
//     postsCount:       0,
//     liveViewers:      0,
//     createdAt:        serverTimestamp(),
//     updatedAt:        serverTimestamp(),
//   });
//   return ref.id;
// };


// ─────────────────────────────────────────────────────────────
// createBrand
//
// Called by useAdminBrandActions.create().
// 1. Spins up a temporary secondary Firebase app.
// 2. Creates a real Firebase Auth account with the supplied
//    email + password (secondary app → admin stays signed in).
// 3. Tears down the secondary app immediately.
// 4. Writes the brand Firestore document with ownerUid = new UID.
// 5. Creates a minimal user profile document for the brand.
//
// The admin never sees or sets the UID.
// Revenue and isLive are ALWAYS initialised to 0 / false here —
// the brand owner updates them from their own profile.
// ─────────────────────────────────────────────────────────────
export const createBrand = async (
  data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'subscribersCount' | 'postsCount' | 'liveViewers'>,
  credentials: { email: string; password: string },
): Promise<string> => {

  // ── 1. Secondary app (prevents admin sign-out) ────────────
  const secondaryAppName = `brand-create-${Date.now()}`;
  let secondaryApp: FirebaseApp | null = null;

  let brandUid: string;
  let isExistingUser = false;

  try {
    secondaryApp = initializeApp(
      app.options,   // same Firebase project config
      secondaryAppName,
    );
    const secondaryAuth = getAuth(secondaryApp);
    try {
      // ── 2a. Happy path: create new account ─────────────────
      const { user } = await createUserWithEmailAndPassword(
        secondaryAuth,
        credentials.email,
        credentials.password,
      );
      brandUid = user.uid;
    } catch (err: any) {
      if (
        err.code === 'auth/email-already-in-use' ||
        err.code === 'auth/account-exists-with-different-credential'
      ) {
        // ── 2b. Email exists: sign in and link instead ────────
        const { user } = await signInWithEmailAndPassword(
          secondaryAuth,
          credentials.email,
          credentials.password,
        );
        brandUid = user.uid;
        isExistingUser = true;
      } else {
        // Re-throw anything else (wrong password format, etc.)
        throw err;
      }
    }

  } finally {
    // ── 3. Tear down secondary app regardless of outcome ─────
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }

  // ── 4. Write brand Firestore document ────────────────────
  // If linking to an existing user, check whether they already
  // own a brand and bail out early with a clear message.
  if (isExistingUser) {
    const existingBrand = await getDoc(doc(db, 'brands', brandUid));
    if (existingBrand.exists()) {
      throw new Error(
        `This account already owns the brand "${existingBrand.data().name}". ` +
        'Each account can only be linked to one brand.'
      );
    }
  }

  
  const brandRef = doc(db, 'brands', brandUid); // use uid as doc id for easy lookup
  const brandDoc: Brand = {
    ...data,
    id:               brandUid,
    ownerUid:         brandUid,
    revenue:          0,        // brand sets this themselves
    isLive:           false,    // brand sets this themselves
    subscribersCount: 0,
    postsCount:       0,
    liveViewers:      0,
    createdAt:        serverTimestamp() as any,
    updatedAt:        serverTimestamp() as any,
  };
  await setDoc(brandRef, brandDoc);

  // ── 5. Create a minimal User profile for the brand account ─
  await setDoc(doc(db, 'users', brandUid), {
    uid:                brandUid,
    username:           data.handle.replace('@', '').toLowerCase(),
    displayName:        data.name,
    email:              credentials.email,
    bio:                data.bio ?? '',
    avatarUrl:          data.logoUrl ?? '',
    website:            data.website ?? '',
    isVerified:         data.isVerified ?? false,
    isPrivate:          false,
    followersCount:     0,
    followingCount:     0,
    postsCount:         0,
    subscriptionTier:   data.plan ?? 'free',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: null,
    // Link back to brand
    brandId:            brandUid,
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
  }, { merge: true }); // merge to avoid overwriting if user later updates profile

  return brandUid;
};

// ── READ all brands (paginated, public) ───────────────────────
export const getBrands = async (pageSize = 30): Promise<Brand[]> => {
  const q = query(
    collection(db, 'brands'),
    where('status', '!=', 'suspended'),
    orderBy('status'),
    orderBy('subscribersCount', 'desc'),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand));
};

// ── READ all brands for admin (including suspended) ───────────
export const getAdminBrands = async (): Promise<Brand[]> => {
  assertAdmin();
  const snap = await getDocs(query(collection(db, 'brands'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand));
};

// ── REAL-TIME brands listener (feed carousel) ─────────────────
export const subscribeToBrands = (
  callback: (brands: Brand[]) => void,
): Unsubscribe =>
  onSnapshot(
    query(
      collection(db, 'brands'),
      where('status', '==', 'active'),
      orderBy('subscribersCount', 'desc'),
      limit(30),
    ),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand))),
  );

// ── REAL-TIME admin brands listener ──────────────────────────
export const subscribeToAdminBrands = (
  callback: (brands: Brand[]) => void,
): Unsubscribe =>
  onSnapshot(
    query(collection(db, 'brands'), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand))),
  );

// ── UPDATE brand (admin only) ─────────────────────────────────
export const updateBrand = async (
  id: string,
  data: Partial<Omit<Brand, 'id' | 'createdAt'>>,
): Promise<void> => {
  assertAdmin();
  await updateDoc(doc(db, 'brands', id), { ...data, updatedAt: serverTimestamp() });
};

// ── DELETE brand (admin only) ─────────────────────────────────
export const deleteBrand = async (id: string): Promise<void> => {
  assertAdmin();
  // Optionally delete logo/cover from Storage too
  await deleteDoc(doc(db, 'brands', id));
};

// ── SUBSCRIBE / UNSUBSCRIBE user to brand ────────────────────
export const toggleBrandSubscription = async (brandId: string): Promise<boolean> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const subRef = doc(db, 'brands', brandId, 'subscribers', uid);
  const snap   = await getDoc(subRef);

  if (snap.exists()) {
    await deleteDoc(subRef);
    await updateDoc(doc(db, 'brands', brandId), { subscribersCount: increment(-1) });
    return false; // unsubscribed
  } else {
    await setDoc(subRef, { uid, subscribedAt: serverTimestamp() });
    await updateDoc(doc(db, 'brands', brandId), { subscribersCount: increment(1) });
    return true; // subscribed
  }
};

// ── CHECK if user is subscribed ───────────────────────────────
export const isBrandSubscribed = async (brandId: string): Promise<boolean> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'brands', brandId, 'subscribers', uid));
  return snap.exists();
};

// ── GET posts for a brand ─────────────────────────────────────
export const getBrandPosts = async (brandId: string, pageSize = 12) => {
  const q = query(
    collection(db, 'posts'),
    where('brandId', '==', brandId),
    where('isArchived', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
