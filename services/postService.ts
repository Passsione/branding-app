// src/services/postService.ts
// =====================================================
// POST SERVICE — CRUD, LIKES, FEED
// =====================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  runTransaction,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';
import { Post, Like, MediaItem, PostType, SUBSCRIPTION_PLANS } from '../types';

// ─────────────────────────────────────────────
// UPLOAD MEDIA
// ─────────────────────────────────────────────
export const uploadMedia = (
  uri: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return reject(new Error('Not authenticated'));

    // Convert URI to Blob (React Native)
    const response = await fetch(uri);
    const blob = await response.blob();

    const storageRef = ref(storage, `posts/${uid}/${Date.now()}_${fileName}`);
    const task = uploadBytesResumable(storageRef, blob);

    task.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
};

// ─────────────────────────────────────────────
// CREATE POST
// ─────────────────────────────────────────────
export const createPost = async (params: {
  type: PostType;
  media: MediaItem[];
  caption: string;
  tags?: string[];
  mentions?: string[];
  location?: Post['location'];
}): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  // Enforce daily post limit based on subscription
  await enforcePostLimit(uid);

  const postData: Omit<Post, 'id'> = {
    authorId: uid,
    type: params.type,
    media: params.media,
    caption: params.caption,
    tags: params.tags ?? [],
    mentions: params.mentions ?? [],
    location: params.location,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    isArchived: false,
    isCommentsDisabled: false,
    isLikesHidden: false,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  // Run transaction: create post + increment user's postsCount + fan-out feed
  const postRef = await addDoc(collection(db, 'posts'), postData);

  // Increment user post count
  await updateDoc(doc(db, 'users', uid), {
    postsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  // Trigger feed fan-out via Cloud Function (see functions/index.ts)
  // The 'onPostCreate' trigger handles distributing to followers' feeds

  return postRef.id;
};

// ─────────────────────────────────────────────
// ENFORCE POST LIMIT
// ─────────────────────────────────────────────
const enforcePostLimit = async (uid: string): Promise<void> => {
  const userSnap = await getDoc(doc(db, 'users', uid));
  const user = userSnap.data();
  if (!user) throw new Error('User not found');

  const plan = SUBSCRIPTION_PLANS[user.subscriptionTier as keyof typeof SUBSCRIPTION_PLANS];
  if (plan.features.maxPostsPerDay === -1) return; // unlimited

  // Count posts created today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayPostsSnap = await getDocs(
    query(
      collection(db, 'posts'),
      where('authorId', '==', uid),
      where('createdAt', '>=', startOfDay),
      limit(plan.features.maxPostsPerDay + 1)
    )
  );

  if (todayPostsSnap.size >= plan.features.maxPostsPerDay) {
    throw new Error(
      `Daily post limit reached (${plan.features.maxPostsPerDay}/day on ${plan.name} plan). Upgrade for more.`
    );
  }
};

// ─────────────────────────────────────────────
// GET SINGLE POST
// ─────────────────────────────────────────────
export const getPost = async (postId: string): Promise<Post | null> => {
  const snap = await getDoc(doc(db, 'posts', postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Post;
};

// ─────────────────────────────────────────────
// DELETE POST
// ─────────────────────────────────────────────
export const deletePost = async (postId: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const post = await getPost(postId);
  if (!post) throw new Error('Post not found');
  if (post.authorId !== uid) throw new Error('Unauthorized');

  // Delete media from storage
  await Promise.all(
    post.media.map(async (m) => {
      try {
        const storageRef = ref(storage, m.url);
        await deleteObject(storageRef);
      } catch {
        // Ignore if already deleted
      }
    })
  );

  // Delete post document and decrement count
  await Promise.all([
    deleteDoc(doc(db, 'posts', postId)),
    updateDoc(doc(db, 'users', uid), {
      postsCount: increment(-1),
      updatedAt: serverTimestamp(),
    }),
  ]);
};

// ─────────────────────────────────────────────
// LIKE / UNLIKE POST  (atomic transaction)
// ─────────────────────────────────────────────
export const toggleLike = async (postId: string): Promise<boolean> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const likeId = `${uid}_${postId}`;
  const likeRef = doc(db, 'posts', postId, 'likes', uid);
  const postRef = doc(db, 'posts', postId);

  let liked = false;

  await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);

    if (likeSnap.exists()) {
      // Unlike
      tx.delete(likeRef);
      tx.update(postRef, { likesCount: increment(-1) });
      liked = false;
    } else {
      // Like
      tx.set(likeRef, {
        userId: uid,
        postId,
        createdAt: serverTimestamp(),
      } as Omit<Like, 'id'>);
      tx.update(postRef, { likesCount: increment(1) });
      liked = true;

      // Notify post author (handled by Cloud Function onLikeCreate)
    }
  });

  return liked;
};

// ─────────────────────────────────────────────
// CHECK IF USER LIKED A POST
// ─────────────────────────────────────────────
export const isPostLiked = async (postId: string): Promise<boolean> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', uid));
  return snap.exists();
};

// ─────────────────────────────────────────────
// GET USER POSTS (paginated)
// ─────────────────────────────────────────────
export const getUserPosts = async (
  userId: string,
  pageSize = 12,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ posts: Post[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  let q = query(
    collection(db, 'posts'),
    where('authorId', '==', userId),
    where('isArchived', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) q = query(q, startAfter(lastDoc));

  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
  const last = snap.docs[snap.docs.length - 1] ?? null;

  return { posts, lastDoc: last };
};

// ─────────────────────────────────────────────
// GET FEED (paginated)
// ─────────────────────────────────────────────
export const getFeed = async (
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ posts: Post[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  let q = query(
    collection(db, 'feed', uid, 'items'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) q = query(q, startAfter(lastDoc));

  const feedSnap = await getDocs(q);
  const postIds = feedSnap.docs.map((d) => d.id);

  // Fetch actual posts
  const posts = await Promise.all(
    postIds.map((id) => getPost(id))
  );

  return {
    posts: posts.filter(Boolean) as Post[],
    lastDoc: feedSnap.docs[feedSnap.docs.length - 1] ?? null,
  };
};

// ─────────────────────────────────────────────
// EXPLORE / TRENDING (by likes, last 7 days)
// ─────────────────────────────────────────────
export const getExplorePosts = async (pageSize = 30): Promise<Post[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, 'posts'),
    where('isArchived', '==', false),
    where('createdAt', '>=', sevenDaysAgo),
    orderBy('createdAt', 'desc'),
    orderBy('likesCount', 'desc'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
};

// ─────────────────────────────────────────────
// REAL-TIME LIKE COUNT LISTENER
// ─────────────────────────────────────────────
export const subscribeToPostLikes = (
  postId: string,
  callback: (count: number) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'posts', postId), (snap) => {
    if (snap.exists()) callback(snap.data().likesCount ?? 0);
  });
};
