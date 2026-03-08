// services/commentService.ts
// =====================================================
// COMMENT SERVICE
// =====================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  increment,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Comment } from '../types';

// ─────────────────────────────────────────────
// ADD COMMENT
// ─────────────────────────────────────────────
export const addComment = async (
  postId: string,
  text: string,
  parentId?: string
): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const commentData: Omit<Comment, 'id'> = {
    postId,
    authorId: uid,
    text: text.trim(),
    likesCount: 0,
    parentId,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  const ref = await addDoc(
    collection(db, 'posts', postId, 'comments'),
    commentData
  );

  // Increment post comment count
  await updateDoc(doc(db, 'posts', postId), {
    commentsCount: increment(1),
  });

  return ref.id;
};

// ─────────────────────────────────────────────
// DELETE COMMENT
// ─────────────────────────────────────────────
export const deleteComment = async (
  postId: string,
  commentId: string
): Promise<void> => {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  await updateDoc(doc(db, 'posts', postId), {
    commentsCount: increment(-1),
  });
};

// ─────────────────────────────────────────────
// LIKE COMMENT (atomic)
// ─────────────────────────────────────────────
export const toggleCommentLike = async (
  postId: string,
  commentId: string
): Promise<boolean> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', uid);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);

  let liked = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(likeRef);
    if (snap.exists()) {
      tx.delete(likeRef);
      tx.update(commentRef, { likesCount: increment(-1) });
      liked = false;
    } else {
      tx.set(likeRef, { userId: uid, createdAt: serverTimestamp() });
      tx.update(commentRef, { likesCount: increment(1) });
      liked = true;
    }
  });

  return liked;
};

// ─────────────────────────────────────────────
// GET COMMENTS (paginated)
// ─────────────────────────────────────────────
export const getComments = async (
  postId: string,
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ comments: Comment[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  let q = query(
    collection(db, 'posts', postId, 'comments'),
    where('parentId', '==', null),   // top-level only
    orderBy('createdAt', 'asc'),
    limit(pageSize)
  );

  if (lastDoc) q = query(q, startAfter(lastDoc));

  const snap = await getDocs(q);
  const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));

  return {
    comments,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
};

// ─────────────────────────────────────────────
// REAL-TIME COMMENTS
// ─────────────────────────────────────────────
export const subscribeToComments = (
  postId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
    callback(comments);
  });
};
