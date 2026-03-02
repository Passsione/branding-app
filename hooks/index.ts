// src/hooks/index.ts
// =====================================================
// REACT HOOKS — Auth, Posts, Follows, Subscriptions
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { subscribeToAuthState, getUserProfile } from '../services/authService';
import { getFeed, getUserPosts, toggleLike, isPostLiked, subscribeToPostLikes } from '../services/postService';
import { toggleFollow, getFollowStatus, subscribeToFollowerCount } from '../services/followService';
import { subscribeToSubscription, canUseFeature } from '../services/subscriptionService';
import { Post, User, SubscriptionTier } from '../types';

// ─────────────────────────────────────────────
// useAuth — current user state
// ─────────────────────────────────────────────
export const useAuth = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuthState(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { firebaseUser, userProfile, loading, isAuthenticated: !!firebaseUser };
};

// ─────────────────────────────────────────────
// useFeed — paginated home feed
// ─────────────────────────────────────────────
export const useFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<any>(null);

  const loadFeed = useCallback(async (refresh = false) => {
    if (refresh) {
      lastDocRef.current = null;
      setPosts([]);
      setHasMore(true);
    }
    setLoading(refresh);
    setLoadingMore(!refresh);

    try {
      const { posts: newPosts, lastDoc } = await getFeed(20, refresh ? undefined : lastDocRef.current);
      lastDocRef.current = lastDoc;
      setPosts((prev) => (refresh ? newPosts : [...prev, ...newPosts]));
      setHasMore(newPosts.length === 20);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadFeed(true); }, [loadFeed]);

  return { posts, loading, loadingMore, hasMore, refresh: () => loadFeed(true), loadMore: () => loadFeed(false) };
};

// ─────────────────────────────────────────────
// usePost — single post with like state
// ─────────────────────────────────────────────
export const usePost = (postId: string) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    isPostLiked(postId).then(setLiked);
    const unsub = subscribeToPostLikes(postId, setLikesCount);
    return unsub;
  }, [postId]);

  const handleToggleLike = useCallback(async () => {
    const newLiked = await toggleLike(postId);
    setLiked(newLiked);
  }, [postId]);

  return { liked, likesCount, toggleLike: handleToggleLike };
};

// ─────────────────────────────────────────────
// useFollow — follow state for a user
// ─────────────────────────────────────────────
export const useFollow = (targetUserId: string) => {
  const [followStatus, setFollowStatus] = useState<'none' | 'active' | 'pending'>('none');
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFollowStatus(targetUserId).then((status) => {
      setFollowStatus(status ?? 'none');
    });
    const unsub = subscribeToFollowerCount(targetUserId, setFollowersCount);
    return unsub;
  }, [targetUserId]);

  const handleToggleFollow = useCallback(async () => {
    setLoading(true);
    try {
      const result = await toggleFollow(targetUserId);
      if (result.action === 'unfollowed') setFollowStatus('none');
      else if (result.action === 'requested') setFollowStatus('pending');
      else setFollowStatus('active');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  return { followStatus, followersCount, toggleFollow: handleToggleFollow, loading };
};

// ─────────────────────────────────────────────
// useSubscription — current plan + feature gates
// ─────────────────────────────────────────────
export const useSubscription = () => {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<User['subscriptionStatus']>('none');

  useEffect(() => {
    try {
      const unsub = subscribeToSubscription((newTier, newStatus) => {
        setTier(newTier);
        setStatus(newStatus);
      });
      return unsub;
    } catch {
      // Not authenticated
    }
  }, []);

  const checkFeature = useCallback(
    (feature: Parameters<typeof canUseFeature>[0]) => canUseFeature(feature),
    []
  );

  const isActive = status === 'active' || status === 'trialing';

  return { tier, status, isActive, checkFeature };
};

// ─────────────────────────────────────────────
// useUserPosts — profile grid posts
// ─────────────────────────────────────────────
export const useUserPosts = (userId: string) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const lastDocRef = useRef<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (refresh = false) => {
    if (refresh) { lastDocRef.current = null; setPosts([]); setHasMore(true); }
    setLoading(true);
    const { posts: newPosts, lastDoc } = await getUserPosts(userId, 12, refresh ? undefined : lastDocRef.current);
    lastDocRef.current = lastDoc;
    setPosts((prev) => (refresh ? newPosts : [...prev, ...newPosts]));
    setHasMore(newPosts.length === 12);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(true); }, [load]);

  return { posts, loading, hasMore, loadMore: () => load(false), refresh: () => load(true) };
};
