// services/followService.ts
// =====================================================
// FOLLOW / UNFOLLOW SERVICE
// =====================================================

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction,
  increment,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Follow, User } from '../types';

// ─────────────────────────────────────────────
// FOLLOW / UNFOLLOW (atomic)
// ─────────────────────────────────────────────
export const toggleFollow = async (
  targetUserId: string
): Promise<{ action: 'followed' | 'unfollowed' | 'requested'; status: Follow['status'] }> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  if (uid === targetUserId) throw new Error('Cannot follow yourself');

  const followId = `${uid}_${targetUserId}`;
  const followRef = doc(db, 'follows', followId);
  const followerRef = doc(db, 'users', uid);
  const followingRef = doc(db, 'users', targetUserId);

  // Check if target account is private
  const targetSnap = await getDoc(followingRef);
  if (!targetSnap.exists()) throw new Error('User not found');
  const targetUser = targetSnap.data() as User;
  const isPrivate = targetUser.isPrivate;

  let result: { action: 'followed' | 'unfollowed' | 'requested'; status: Follow['status'] } =
    { action: 'followed', status: 'active' };

  await runTransaction(db, async (tx) => {
    const followSnap = await tx.get(followRef);

    if (followSnap.exists()) {
      // Unfollow / cancel request
      tx.delete(followRef);

      if (followSnap.data().status === 'active') {
        tx.update(followerRef, { followingCount: increment(-1) });
        tx.update(followingRef, { followersCount: increment(-1) });
      }

      result = { action: 'unfollowed', status: 'active' };
    } else {
      const status: Follow['status'] = isPrivate ? 'pending' : 'active';

      const followData: Omit<Follow, 'id'> = {
        followerId: uid,
        followingId: targetUserId,
        status,
        createdAt: serverTimestamp() as any,
      };

      tx.set(followRef, followData);

      if (status === 'active') {
        tx.update(followerRef, { followingCount: increment(1) });
        tx.update(followingRef, { followersCount: increment(1) });
      }

      result = { action: isPrivate ? 'requested' : 'followed', status };
    }
  });

  return result;
};

// ─────────────────────────────────────────────
// ACCEPT / DENY FOLLOW REQUEST (private accounts)
// ─────────────────────────────────────────────
export const acceptFollowRequest = async (requesterId: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const followId = `${requesterId}_${uid}`;
  const followRef = doc(db, 'follows', followId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(followRef);
    if (!snap.exists() || snap.data().status !== 'pending') {
      throw new Error('No pending request found');
    }

    tx.update(followRef, { status: 'active' });
    tx.update(doc(db, 'users', requesterId), { followingCount: increment(1) });
    tx.update(doc(db, 'users', uid), { followersCount: increment(1) });
  });
};

export const denyFollowRequest = async (requesterId: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const followId = `${requesterId}_${uid}`;
  await deleteDoc(doc(db, 'follows', followId));
};

// ─────────────────────────────────────────────
// CHECK FOLLOW STATUS
// ─────────────────────────────────────────────
export const getFollowStatus = async (
  targetUserId: string
): Promise<Follow['status'] | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'follows', `${uid}_${targetUserId}`));
  if (!snap.exists()) return null;
  return snap.data().status as Follow['status'];
};

// ─────────────────────────────────────────────
// GET FOLLOWERS LIST
// ─────────────────────────────────────────────
export const getFollowers = async (
  userId: string,
  pageSize = 20
): Promise<User[]> => {
  const q = query(
    collection(db, 'follows'),
    where('followingId', '==', userId),
    where('status', '==', 'active'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  const followerIds = snap.docs.map((d) => d.data().followerId as string);

  const users = await Promise.all(
    followerIds.map(async (id) => {
      const userSnap = await getDoc(doc(db, 'users', id));
      return userSnap.exists() ? (userSnap.data() as User) : null;
    })
  );

  return users.filter(Boolean) as User[];
};

// ─────────────────────────────────────────────
// GET FOLLOWING LIST
// ─────────────────────────────────────────────
export const getFollowing = async (
  userId: string,
  pageSize = 20
): Promise<User[]> => {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', userId),
    where('status', '==', 'active'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  const followingIds = snap.docs.map((d) => d.data().followingId as string);

  const users = await Promise.all(
    followingIds.map(async (id) => {
      const userSnap = await getDoc(doc(db, 'users', id));
      return userSnap.exists() ? (userSnap.data() as User) : null;
    })
  );

  return users.filter(Boolean) as User[];
};

// ─────────────────────────────────────────────
// GET PENDING FOLLOW REQUESTS
// ─────────────────────────────────────────────
export const getPendingFollowRequests = async (): Promise<User[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const q = query(
    collection(db, 'follows'),
    where('followingId', '==', uid),
    where('status', '==', 'pending')
  );

  const snap = await getDocs(q);
  const requesterIds = snap.docs.map((d) => d.data().followerId as string);

  const users = await Promise.all(
    requesterIds.map(async (id) => {
      const userSnap = await getDoc(doc(db, 'users', id));
      return userSnap.exists() ? (userSnap.data() as User) : null;
    })
  );

  return users.filter(Boolean) as User[];
};

// ─────────────────────────────────────────────
// REAL-TIME FOLLOWER COUNT
// ─────────────────────────────────────────────
export const subscribeToFollowerCount = (
  userId: string,
  callback: (count: number) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) callback(snap.data().followersCount ?? 0);
  });
};

// ─────────────────────────────────────────────
// GET MUTUAL FOLLOWERS (friends of friends)
// ─────────────────────────────────────────────
export const getMutualFollowers = async (
  targetUserId: string
): Promise<{ count: number; previews: User[] }> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { count: 0, previews: [] };

  // Get IDs of people current user follows
  const myFollowingSnap = await getDocs(
    query(
      collection(db, 'follows'),
      where('followerId', '==', uid),
      where('status', '==', 'active')
    )
  );
  const myFollowingIds = new Set(
    myFollowingSnap.docs.map((d) => d.data().followingId as string)
  );

  // Get IDs of people who follow target
  const targetFollowersSnap = await getDocs(
    query(
      collection(db, 'follows'),
      where('followingId', '==', targetUserId),
      where('status', '==', 'active')
    )
  );
  const targetFollowerIds = targetFollowersSnap.docs.map(
    (d) => d.data().followerId as string
  );

  const mutualIds = targetFollowerIds.filter((id) => myFollowingIds.has(id));

  const previews = await Promise.all(
    mutualIds.slice(0, 3).map(async (id) => {
      const snap = await getDoc(doc(db, 'users', id));
      return snap.exists() ? (snap.data() as User) : null;
    })
  );

  return {
    count: mutualIds.length,
    previews: previews.filter(Boolean) as User[],
  };
};
