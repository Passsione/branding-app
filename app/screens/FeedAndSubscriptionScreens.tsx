// ============================================================
// screens/FeedScreen.tsx
// React Native — Instagram Clone Feed UI
// npm install @shopify/flash-list react-native-linear-gradient
//             react-native-fast-image @react-native-community/blur
//             react-native-reanimated react-native-gesture-handler
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, FlatList,
  StatusBar, Pressable, Platform, Dimensions, TextInput,
  ActivityIndicator,
} from 'react-native';
// import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Tokens ──────────────────────────────────────────────────
const C = {
  bg:       '#0a0a0a',
  surface:  '#0f0f0f',
  border:   '#1c1c1c',
  text:     '#f2f2f2',
  sub:      '#888',
  muted:    '#444',
  accent:   '#e1306c',
  blue:     '#3b82f6',
  purple:   '#8b5cf6',
  gold:     '#f59e0b',
};

// ─── Mock data ────────────────────────────────────────────────
const STORIES = [
  { id: '0', username: 'Your Story', avatar: 'https://i.pravatar.cc/150?img=1', isOwn: true, seen: false },
  { id: '1', username: 'alex.mv',    avatar: 'https://i.pravatar.cc/150?img=2', seen: false },
  { id: '2', username: 'priya_k',    avatar: 'https://i.pravatar.cc/150?img=3', seen: false },
  { id: '3', username: 'marco.d',    avatar: 'https://i.pravatar.cc/150?img=4', seen: true  },
  { id: '4', username: 'jess.wu',    avatar: 'https://i.pravatar.cc/150?img=5', seen: false },
  { id: '5', username: 'noah_x',     avatar: 'https://i.pravatar.cc/150?img=6', seen: true  },
  { id: '6', username: 'lila.art',   avatar: 'https://i.pravatar.cc/150?img=7', seen: false },
];

const POSTS = [
  {
    id: '1', username: 'alex.mv', avatar: 'https://i.pravatar.cc/150?img=2',
    location: 'Cape Town, ZA',
    image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800',
    likes: 1243, comments: 48, time: '2h',
    caption: 'Golden hour never hits different anywhere else. 🌅 #capetown #goldenhour',
    liked: false, saved: false, isLocked: false,
  },
  {
    id: '2', username: 'priya_k', avatar: 'https://i.pravatar.cc/150?img=3',
    location: 'Mumbai, IN',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    likes: 892, comments: 31, time: '4h',
    caption: 'Street food season is officially here 🍢🔥',
    liked: true, saved: false, isLocked: false,
  },
  {
    id: '3', username: 'lila.art', avatar: 'https://i.pravatar.cc/150?img=7',
    location: null,
    image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800',
    likes: 3107, comments: 204, time: '6h',
    caption: 'New series dropping soon. Exclusive preview for Pro members only ✦',
    liked: false, saved: true, isLocked: true, requiredPlan: 'pro',
  },
  {
    id: '4', username: 'marco.d', avatar: 'https://i.pravatar.cc/150?img=4',
    location: 'Rome, IT',
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    likes: 574, comments: 19, time: '9h',
    caption: 'Eternal city, eternal mood. 🏛️ #rome #architecture',
    liked: false, saved: false, isLocked: false,
  },
];

// ─── SVG-free icon set (text-based fallbacks for preview) ────
// In your real app use: npm install react-native-vector-icons
// and replace these with <Icon name="heart" ... />
const Ico = {
  Heart:    ({ filled }: { filled?: boolean }) => <Text style={{ fontSize: 24, color: filled ? '#ef4444' : C.text }}>{ filled ? '❤️' : '🤍'}</Text>,
  Comment:  () => <Text style={{ fontSize: 22, color: C.text }}>💬</Text>,
  Share:    () => <Text style={{ fontSize: 22, color: C.text }}>➤</Text>,
  Bookmark: ({ filled }: { filled?: boolean }) => <Text style={{ fontSize: 22, color: C.text }}>{ filled ? '🔖' : '📄'}</Text>,
  More:     () => <Text style={{ fontSize: 20, color: C.sub, letterSpacing: 2 }}>•••</Text>,
  Lock:     () => <Text style={{ fontSize: 34 }}>🔒</Text>,
  Plus:     () => <Text style={{ fontSize: 22, color: '#fff', lineHeight: 24 }}>+</Text>,
  Check:    () => <Text style={{ fontSize: 12, color: '#22c55e' }}>✓</Text>,
  Cross:    () => <Text style={{ fontSize: 11, color: C.muted }}>✕</Text>,
  Crown:    () => <Text style={{ fontSize: 20 }}>👑</Text>,
};

// ─── Story Item ───────────────────────────────────────────────
interface StoryItemProps {
  story: typeof STORIES[0];
  onPress: () => void;
}
const StoryItem: React.FC<StoryItemProps> = ({ story, onPress }) => {
  const ringColors = story.seen
    ? ['#2a2a2a', '#2a2a2a']
    : story.isOwn
    ? ['#2a2a2a', '#2a2a2a']
    : ['#f9ce34', '#ee2a7b', '#6228d7'];

  return (
    <TouchableOpacity onPress={onPress} style={styles.storyItem} activeOpacity={0.8}>
      {/* <LinearGradient colors={ringColors} style={styles.storyRingOuter} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}> */}
        <View style={styles.storyRingInner}>
          <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
        </View>
      {/* </LinearGradient> */}

      {story.isOwn && (
        <View style={styles.storyAddBtn}>
          <Ico.Plus />
        </View>
      )}

      <Text style={[styles.storyUsername, story.seen && { color: C.muted }]} numberOfLines={1}>
        {story.isOwn ? 'Your Story' : story.username}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Locked overlay ───────────────────────────────────────────
const LockedOverlay: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => (
  <View style={styles.lockedOverlay}>
    <View style={styles.lockedIconWrap}>
      <Ico.Lock />
    </View>
    <Text style={styles.lockedTitle}>Pro Members Only</Text>
    <Text style={styles.lockedSub}>Upgrade to unlock exclusive content</Text>
    <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85}>
      {/* <LinearGradient colors={['#8b5cf6', '#6d28d9']} style={styles.lockedBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}> */}
        <Text style={styles.lockedBtnText}>Upgrade to Pro</Text>
      {/* </LinearGradient> */}
    </TouchableOpacity>
  </View>
);

// ─── Post Card ────────────────────────────────────────────────
interface PostCardProps {
  post: typeof POSTS[0];
  onUpgrade: () => void;
}
const PostCard: React.FC<PostCardProps> = ({ post, onUpgrade }) => {
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likeCount, setLikeCount] = useState(post.likes);
  const lastTap = useRef(0);

  const toggleLike = useCallback(() => {
    if (post.isLocked) return;
    setLiked(l => {
      setLikeCount(c => l ? c - 1 : c + 1);
      return !l;
    });
  }, [post.isLocked]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked && !post.isLocked) toggleLike();
    }
    lastTap.current = now;
  }, [liked, post.isLocked, toggleLike]);

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <Image source={{ uri: post.avatar }} style={styles.postAvatar} />
        <View style={styles.postHeaderText}>
          <Text style={styles.postUsername}>{post.username}</Text>
          {post.location ? <Text style={styles.postLocation}>{post.location}</Text> : null}
        </View>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ico.More />
        </TouchableOpacity>
      </View>

      {/* Image */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.postImageWrap}>
          <Image
            source={{ uri: post.image }}
            style={styles.postImage}
            blurRadius={post.isLocked ? 18 : 0}
          />
          {post.isLocked && <LockedOverlay onUpgrade={onUpgrade} />}
        </View>
      </TouchableWithoutFeedback>

      {/* Actions */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ico.Heart filled={liked} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ico.Comment />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ico.Share />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setSaved(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ico.Bookmark filled={saved} />
        </TouchableOpacity>
      </View>

      {/* Meta */}
      <View style={styles.postMeta}>
        <Text style={styles.postLikes}>{likeCount.toLocaleString()} likes</Text>
        <Text style={styles.postCaption} numberOfLines={2}>
          <Text style={styles.postCaptionUsername}>{post.username} </Text>
          {post.caption}
        </Text>
        <Text style={styles.postComments}>View all {post.comments} comments</Text>
        <Text style={styles.postTime}>{post.time} ago</Text>
      </View>
    </View>
  );
};

// ─── Feed Screen ──────────────────────────────────────────────
interface FeedScreenProps {
  onNavigateToSubscription: () => void;
}
export const FeedScreen: React.FC<FeedScreenProps> = ({ onNavigateToSubscription }) => {
  const [stories, setStories] = useState(STORIES);

  const markSeen = (id: string) => setStories(s => s.map(st => st.id === id ? { ...st, seen: true } : st));

  const renderPost = useCallback(({ item }: { item: typeof POSTS[0] }) => (
    <PostCard post={item} onUpgrade={onNavigateToSubscription} />
  ), [onNavigateToSubscription]);

  const ListHeader = (
    <View>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navBrand}>Name</Text>
        <View style={styles.navActions}>
          {/* <TouchableOpacity style={styles.navBtn}><Ico.Heart /></TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}><Ico.Comment /></TouchableOpacity> */}
        </View>
      </View>
      {/* Stories */}
      {/* <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.storiesBar} contentContainerStyle={styles.storiesContent}
      >
        {stories.map(story => (
          <StoryItem key={story.id} story={story} onPress={() => markSeen(story.id)} />
        ))}
      </ScrollView> */}
      <View style={styles.divider} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <FlatList
        data={POSTS}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.loader}>
            <ActivityIndicator color={C.muted} />
          </View>
        }
      />
    </View>
  );
};

// ─── Subscription Screen ──────────────────────────────────────
const PLANS = [
  {
    id: 'free', name: 'Free', price: 0, color: C.muted, accent: '#9ca3af', tag: null,
    features: ['10 posts per day', '5 stories per day', '1-min reels', 'Basic explore'],
    missing: ['Analytics', 'Scheduling', 'Content gating'],
  },
  {
    id: 'basic', name: 'Basic', price: 4.99, color: C.blue, accent: '#60a5fa', tag: null,
    features: ['50 posts per day', '20 stories per day', '3-min reels', 'Basic analytics'],
    missing: ['Scheduling', 'Content gating'],
  },
  {
    id: 'pro', name: 'Pro', price: 9.99, color: C.purple, accent: '#a78bfa', tag: 'MOST POPULAR',
    features: ['100 posts per day', '50 stories per day', '10-min reels', 'Advanced analytics', 'Post scheduling', 'Content gating', 'Swipe-up links'],
    missing: ['Verified badge'],
  },
  {
    id: 'creator', name: 'Creator', price: 19.99, color: C.gold, accent: '#fbbf24', tag: 'BEST VALUE',
    features: ['Unlimited posts', 'Unlimited stories', '30-min reels', 'Full analytics', 'Scheduling', 'Content gating', 'Swipe-up links', '✦ Verified badge', 'Priority support'],
    missing: [],
  },
];

interface PlanCardProps {
  plan: typeof PLANS[0];
  isCurrent: boolean;
  billing: 'monthly' | 'yearly';
  onSelect: (id: string) => void;
}
const PlanCard: React.FC<PlanCardProps> = ({ plan, isCurrent, billing, onSelect }) => {
  const price = billing === 'yearly' && plan.price > 0
    ? (plan.price * 10).toFixed(2)
    : plan.price.toFixed(2);

  return (
    <View style={[styles.planCard, isCurrent && { borderColor: plan.accent, shadowColor: plan.color, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 }]}>
      {plan.tag && (
        // <LinearGradient colors={[plan.color, plan.accent]} style={styles.planTag} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={styles.planTagText}>{plan.tag}</Text>
        // </LinearGradient>
      )}

      <View style={styles.planHeader}>
        <View>
          <Text style={styles.planName}>{plan.name}</Text>
          {billing === 'yearly' && plan.price > 0 && (
            <Text style={[styles.planSave, { color: plan.accent }]}>Save 17% yearly</Text>
          )}
        </View>
        <View style={styles.planPriceWrap}>
          {plan.price === 0 ? (
            <Text style={[styles.planPrice, { color: C.muted }]}>Free</Text>
          ) : (
            <>
              <Text style={styles.planPrice}>${price}</Text>
              <Text style={styles.planPeriod}>{billing === 'yearly' ? '/yr' : '/mo'}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.planDivider} />

      {plan.features.map((f, i) => (
        <View key={i} style={styles.planFeatureRow}>
          <View style={[styles.planFeatureIcon, { backgroundColor: plan.color + '28' }]}>
            <Ico.Check />
          </View>
          <Text style={styles.planFeatureText}>{f}</Text>
        </View>
      ))}
      {plan.missing.map((f, i) => (
        <View key={i} style={[styles.planFeatureRow, { opacity: 0.35 }]}>
          <View style={styles.planFeatureIconMissing}>
            <Ico.Cross />
          </View>
          <Text style={[styles.planFeatureText, { color: C.muted }]}>{f}</Text>
        </View>
      ))}

      <TouchableOpacity
        onPress={() => onSelect(plan.id)}
        activeOpacity={plan.price === 0 ? 1 : 0.85}
        style={styles.planBtnWrap}
      >
        {isCurrent ? (
            <Text style={styles.planBtnTextActive}>✦ Current Plan</Text>

          // <LinearGradient colors={[plan.color, plan.accent]} style={styles.planBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          // </LinearGradient>
        ) : (
          <View style={[styles.planBtnOutline, plan.price > 0 && { borderColor: plan.color + '80' }]}>
            <Text style={[styles.planBtnTextOutline, plan.price > 0 && { color: plan.accent }]}>
              {plan.price === 0 ? 'Free Forever' : `Get ${plan.name}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

interface SubscriptionScreenProps {
  onBack?: () => void;
}
export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onBack }) => {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState('free');
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (id === currentPlan || id === 'free') return;
    setConfirmPlan(id);
  };

  const handleConfirm = () => {
    // Wire to StripeSubscriptionService.initiateSubscription() or RevenueCat here
    if (confirmPlan) setCurrentPlan(confirmPlan);
    setConfirmPlan(null);
  };

  const confirmPlanData = PLANS.find(p => p.id === confirmPlan);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Header hero */}
        {/* <LinearGradient colors={['#1a0a2e', C.bg]} style={styles.subHero}> */}
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>✦ UNLOCK YOUR POTENTIAL</Text>
          </View>
          <Text style={styles.subTitle}>Create without{'\n'}limits</Text>
          <Text style={styles.subDesc}>Choose the plan that fits your creative journey</Text>

          {/* Billing toggle */}
          <View style={styles.billingToggle}>
            {(['monthly', 'yearly'] as const).map(b => (
              <TouchableOpacity
                key={b}
                onPress={() => setBilling(b)}
                style={[styles.billingOption, billing === b && styles.billingOptionActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.billingText, billing === b && styles.billingTextActive]}>
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </Text>
                {b === 'yearly' && (
                  <View style={styles.billingBadge}>
                    <Text style={styles.billingBadgeText}>-17%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        {/* </LinearGradient> */}

        {/* Plan cards */}
        <View style={styles.plansContainer}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              billing={billing}
              onSelect={handleSelect}
            />
          ))}
          <Text style={styles.subFooter}>
            Subscriptions renew automatically. Cancel anytime in settings.{'\n'}
            iOS billing via App Store · Android via Google Play
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Bottom Sheet */}
      {confirmPlan && confirmPlanData && (
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback onPress={() => setConfirmPlan(null)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Upgrade to {confirmPlanData.name}</Text>
            <Text style={styles.sheetPrice}>
              ${billing === 'yearly'
                ? (confirmPlanData.price * 10).toFixed(2) + '/year'
                : confirmPlanData.price.toFixed(2) + '/month'} · Cancel anytime
            </Text>
            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85} style={{ marginBottom: 12 }}>
              {/* <LinearGradient
                colors={[confirmPlanData.color, confirmPlanData.accent]}
                style={styles.sheetConfirmBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              > */}
                <Text style={styles.sheetConfirmText}>Confirm Upgrade</Text>
              {/* </LinearGradient> */}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmPlan(null)} style={styles.sheetCancelBtn}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  // ── Navbar
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 10,
    backgroundColor: C.bg,
  },
  navBrand: {
    fontSize: 26, fontWeight: '800', color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.5,
  },
  navActions: { flexDirection: 'row', gap: 16 },
  navBtn: { padding: 4 },

  // ── Stories
  storiesBar: { backgroundColor: C.bg },
  storiesContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  storyItem: { alignItems: 'center', gap: 5, width: 68 },
  storyRingOuter: { borderRadius: 100, padding: 2 },
  storyRingInner: { borderRadius: 100, padding: 2.5, backgroundColor: C.bg },
  storyAvatar: { width: 56, height: 56, borderRadius: 100 },
  storyAddBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.blue, borderWidth: 2, borderColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  storyUsername: { fontSize: 11, color: C.text, textAlign: 'center', maxWidth: 64 },

  divider: { height: 1, backgroundColor: C.border },

  // ── Post
  postCard: { backgroundColor: C.surface, marginBottom: 1, borderBottomWidth: 1, borderBottomColor: C.border },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postHeaderText: { flex: 1 },
  postUsername: { fontSize: 13.5, fontWeight: '700', color: C.text },
  postLocation: { fontSize: 11.5, color: C.sub, marginTop: 1 },
  postImageWrap: { position: 'relative', backgroundColor: '#111' },
  postImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH, resizeMode: 'cover' },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.8)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  lockedIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#1a0a2e',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  lockedTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  lockedSub: { fontSize: 13, color: C.sub, marginBottom: 8 },
  lockedBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  lockedBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  postActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  postActionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn: { padding: 2 },
  postMeta: { paddingHorizontal: 14, paddingBottom: 14 },
  postLikes: { fontSize: 13.5, fontWeight: '700', color: C.text, marginBottom: 4 },
  postCaption: { fontSize: 13.5, color: '#d4d4d4', lineHeight: 20, marginBottom: 4 },
  postCaptionUsername: { fontWeight: '700', color: C.text },
  postComments: { fontSize: 13, color: C.sub, marginBottom: 3 },
  postTime: { fontSize: 11, color: C.muted },
  loader: { padding: 24, alignItems: 'center' },

  // ── Subscription
  subHero: {
    paddingTop: Platform.OS === 'ios' ? 64 : 28,
    paddingBottom: 28, paddingHorizontal: 20,
    alignItems: 'center',
  }, 
  subBadge: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 16,
  },
  subBadgeText: { color: '#a78bfa', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  subTitle: {
    fontSize: 34, fontWeight: '800', color: C.text, textAlign: 'center',
    lineHeight: 40, marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subDesc: { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  billingToggle: {
    flexDirection: 'row', backgroundColor: '#141414',
    borderWidth: 1, borderColor: '#222', borderRadius: 30, padding: 3,
  },
  billingOption: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  billingOptionActive: { backgroundColor: '#1e1e1e' },
  billingText: { fontSize: 13, fontWeight: '600', color: C.muted },
  billingTextActive: { color: C.text },
  billingBadge: { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  billingBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  plansContainer: { padding: 16, gap: 16 },
  planCard: {
    backgroundColor: C.surface,
    borderRadius: 20, borderWidth: 2, borderColor: C.border,
    padding: 20, position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  planTag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  planTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName: { fontSize: 22, fontWeight: '800', color: C.text },
  planSave: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { fontSize: 28, fontWeight: '800', color: C.text },
  planPeriod: { fontSize: 12, color: C.sub, marginTop: 2 },
  planDivider: { height: 1, backgroundColor: C.border, marginBottom: 14 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planFeatureIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planFeatureIconMissing: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  planFeatureText: { fontSize: 13.5, color: '#c0c0c0', flex: 1 },
  planBtnWrap: { marginTop: 16 },
  planBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  planBtnTextActive: { color: '#fff', fontWeight: '700', fontSize: 15 },
  planBtnOutline: {
    borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  planBtnTextOutline: { fontWeight: '700', fontSize: 14, color: C.muted },

  subFooter: { textAlign: 'center', fontSize: 11.5, color: C.muted, lineHeight: 18, paddingHorizontal: 16, marginTop: 8 },

  // ── Bottom sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end', zIndex: 100,
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1, borderColor: C.border,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#333', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 6 },
  sheetPrice: { fontSize: 14, color: C.sub, marginBottom: 24 },
  sheetConfirmBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  sheetConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sheetCancelBtn: {
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  sheetCancelText: { color: C.sub, fontWeight: '600', fontSize: 14 },
});
