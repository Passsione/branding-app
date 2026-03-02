// src/types/index.ts
// =====================================================
// COMPLETE TYPE DEFINITIONS
// =====================================================

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'creator';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceMonthly: number;  // USD cents
  priceYearly: number;   // USD cents
  features: {
    maxPostsPerDay: number;        // -1 = unlimited
    canGoLive: boolean;
    analyticsAccess: boolean;
    verifiedBadge: boolean;
    adFree: boolean;
    storageGB: number;
    prioritySupport: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      maxPostsPerDay: 10,
      canGoLive: false,
      analyticsAccess: false,
      verifiedBadge: false,
      adFree: false,
      storageGB: 1,
      prioritySupport: false,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 499,   // $4.99/mo
    priceYearly: 3999,   // $39.99/yr
    features: {
      maxPostsPerDay: 30,
      canGoLive: false,
      analyticsAccess: false,
      verifiedBadge: false,
      adFree: true,
      storageGB: 10,
      prioritySupport: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 999,   // $9.99/mo
    priceYearly: 7999,   // $79.99/yr
    features: {
      maxPostsPerDay: -1,
      canGoLive: true,
      analyticsAccess: true,
      verifiedBadge: false,
      adFree: true,
      storageGB: 50,
      prioritySupport: false,
    },
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    priceMonthly: 1999,  // $19.99/mo
    priceYearly: 15999,  // $159.99/yr
    features: {
      maxPostsPerDay: -1,
      canGoLive: true,
      analyticsAccess: true,
      verifiedBadge: true,
      adFree: true,
      storageGB: 200,
      prioritySupport: true,
    },
  },
};

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────
export interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatarUrl: string;
  website: string;
  isVerified: boolean;
  isPrivate: boolean;

  // Stats (denormalized for performance)
  followersCount: number;
  followingCount: number;
  postsCount: number;

  // Subscription
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  subscriptionExpiresAt: Timestamp | null;
  stripeCustomerId?: string;        // Stripe integration
  revenueCatUserId?: string;        // RevenueCat integration

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────
export type PostType = 'image' | 'video' | 'carousel' | 'reel';

export interface MediaItem {
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  duration?: number; // seconds, for video
}

export interface Post {
  id: string;
  authorId: string;
  author?: User; // populated on read

  type: PostType;
  media: MediaItem[];
  caption: string;
  tags: string[];           // hashtags without #
  mentions: string[];       // userIds mentioned
  location?: {
    name: string;
    lat: number;
    lng: number;
  };

  // Stats (denormalized)
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;

  // Visibility
  isArchived: boolean;
  isCommentsDisabled: boolean;
  isLikesHidden: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// LIKE
// ─────────────────────────────────────────────
export interface Like {
  id: string;          // composite: `${userId}_${postId}`
  userId: string;
  postId: string;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// COMMENT
// ─────────────────────────────────────────────
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  text: string;
  likesCount: number;
  parentId?: string;   // for nested replies
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// FOLLOW
// ─────────────────────────────────────────────
export interface Follow {
  id: string;             // composite: `${followerId}_${followingId}`
  followerId: string;     // the user doing the following
  followingId: string;    // the user being followed
  status: 'active' | 'pending'; // pending for private accounts
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// NOTIFICATION
// ─────────────────────────────────────────────
export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'mention'
  | 'tag';

export interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  actor?: User;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// STORY
// ─────────────────────────────────────────────
export interface Story {
  id: string;
  authorId: string;
  media: MediaItem;
  viewers: string[];       // userIds who viewed
  viewersCount: number;
  expiresAt: Timestamp;   // 24 hours after creation
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// MESSAGE / DM
// ─────────────────────────────────────────────
export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCounts: Record<string, number>; // userId → count
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  postId?: string;  // shared post
  isRead: boolean;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// FEED
// ─────────────────────────────────────────────
export interface FeedItem {
  postId: string;
  authorId: string;
  score: number;    // for algorithmic ranking
  createdAt: Timestamp;
}
