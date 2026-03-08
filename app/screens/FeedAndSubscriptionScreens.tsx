// ============================================================
// app/screens/FeedAndSubscriptionScreens.tsx
// React Native Expo — Firebase-wired Feed + Brand Carousel + Brand Screen
//
// Data sources:
//   useFeed()       → paginated home feed from Firestore
//   usePost()       → per-post real-time likes
//   useAuth()       → current user
//   useSubscription() → plan gating
//   postService     → createPost, deletePost, toggleLike
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, FlatList,
  StatusBar, Platform, Dimensions, Animated,
  ActivityIndicator, RefreshControl,
} from 'react-native';

// ── Firebase hooks & services ─────────────────────────────────
import { useAuth, useFeed, usePost, useSubscription }         from '../../hooks/index';
import { toggleLike }      from '../../services/postService';
import { useBrands, useBrandSubscription } from '../../hooks/brandHooks';
import { Brand }           from '../../services/brandService';

// ── Types ─────────────────────────────────────────────────────
import { Post } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Design Tokens ───────────────────────────────────────────
const C = {
  bg:          '#0d0806',
  surface:     '#120a07',
  surfaceHigh: '#1c100a',
  border:      '#2e1a0e',
  text:        '#f5ede6',
  textSub:     '#c4a090',
  sub:         '#8a6050',
  muted:       '#4a2e20',
  primary:     '#9B5035',
  primaryDk:   '#7D3F2A',
  primaryLt:   '#B8704E',
  primaryGlow: 'rgba(155,80,53,0.25)',
  gold:        '#C8901A',
  goldLt:      '#E8A820',
  goldDk:      '#8B6010',
  goldGlow:    'rgba(200,144,26,0.25)',
  goldBg:      'rgba(200,144,26,0.10)',
  like:        '#c0443a',
  green:       '#5a9e6a',
};

// ─── Brand data comes from Firestore via useBrands() ─────────
// See BrandCarousel component below — it calls useBrands() directly.
// The BRANDS constant is removed; all data is live from Firebase.

// ─── Legacy shape kept for BrandScreen prop compatibility ─────
// BrandScreen accepts a Brand from brandService directly.

const _LEGACY_BRANDS_REMOVED = [
  {
    id: 'b1', name: 'jacket.co', handle: '@jacket.co',
    tagline: 'GOOD VIBES / GREAT BREWS',
    logo: 'https://i.pravatar.cc/150?img=10',
    coverImage: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900',
    isLive: true, liveViewers: 1432, subscribers: 24800,
    subscribedBy: 'mogale_t.g and 3 others', isSubscribed: false,
    fonts: ['LEXTON', 'ARIAL NOVA'],
    bio: 'jacket.co is a modern streetwear brand celebrating bold design and community culture.',
    posts: [
      { id: 'b1p1', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600', likes: 812 },
      { id: 'b1p2', image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600', likes: 1204 },
      { id: 'b1p3', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600', likes: 634 },
      { id: 'b1p4', image: 'https://images.unsplash.com/photo-1563630381190-77c336ea545a?w=600', likes: 980 },
      { id: 'b1p5', image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600', likes: 445 },
      { id: 'b1p6', image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600', likes: 2010 },
    ],
  },
  {
    id: 'b2', name: 'lux.noir', handle: '@lux.noir',
    tagline: 'DARK ELEGANCE / BOLD EDGE',
    logo: 'https://i.pravatar.cc/150?img=20',
    coverImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900',
    isLive: false, liveViewers: 0, subscribers: 18300,
    subscribedBy: 'priya_k and 5 others', isSubscribed: true,
    fonts: ['NOIR', 'HELVETICA'],
    bio: 'lux.noir curates avant-garde fashion for those who lead with darkness and confidence.',
    posts: [
      { id: 'b2p1', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600', likes: 2340 },
      { id: 'b2p2', image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600', likes: 1890 },
      { id: 'b2p3', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600', likes: 3100 },
      { id: 'b2p4', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600', likes: 765 },
    ],
  },
  {
    id: 'b3', name: 'terra.roots', handle: '@terra.roots',
    tagline: 'EARTH / CRAFT / CULTURE',
    logo: 'https://i.pravatar.cc/150?img=30',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900',
    isLive: true, liveViewers: 876, subscribers: 11500,
    subscribedBy: 'alex.mv and 2 others', isSubscribed: false,
    fonts: ['EARTHEN', 'BODONI'],
    bio: 'terra.roots crafts handmade goods inspired by African heritage and natural materials.',
    posts: [
      { id: 'b3p1', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600', likes: 450 },
      { id: 'b3p2', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600', likes: 880 },
      { id: 'b3p3', image: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600', likes: 612 },
    ],
  },
  {
    id: 'b4', name: 'vibe.studio', handle: '@vibe.studio',
    tagline: 'COLOUR / CHAOS / JOY',
    logo: 'https://i.pravatar.cc/150?img=40',
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900',
    isLive: false, liveViewers: 0, subscribers: 9200,
    subscribedBy: 'lila.art and 8 others', isSubscribed: false,
    fonts: ['FUTURA', 'GROTESK'],
    bio: 'vibe.studio is a creative lab for colour-forward streetwear with playful prints.',
    posts: [
      { id: 'b4p1', image: 'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=600', likes: 570 },
      { id: 'b4p2', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600', likes: 1340 },
    ],
  },
];

// ─── Waveform ─────────────────────────────────────────────────
const WAVE = [3, 8, 5, 13, 9, 6, 14, 4, 11, 7, 15, 5, 10, 4, 8, 12, 6, 9];

// ─── Voice Note Player ────────────────────────────────────────
interface VoiceNotePlayerProps {
  uri?: string;
  durationSec?: number;
  isLocked?: boolean;
}
const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  uri, durationSec = 30, isLocked = false,
}) => {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const animRef  = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animRef, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(animRef, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
      timerRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 1) { setPlaying(false); return 0; }
          return p + 1 / (durationSec * 2);
        });
      }, 500);
    } else {
      animRef.stopAnimation();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  const elapsed = Math.round(progress * durationSec);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[vnStyles.container, isLocked && { opacity: 0.4 }]}>
      <View style={vnStyles.hintRow}>
        <Text style={vnStyles.hintDot}>●</Text>
        <Text style={vnStyles.hintText}>
          {isLocked ? 'Upgrade to hear this voice note' : playing ? 'Playing voice note…' : 'Tap ▶ to play voice note'}
        </Text>
      </View>
      <View style={vnStyles.playerRow}>
        <TouchableOpacity
          onPress={() => { if (!isLocked) setPlaying(p => !p); }}
          activeOpacity={isLocked ? 1 : 0.75}
          style={vnStyles.playBtn}
        >
          <Text style={vnStyles.playIcon}>{playing ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        <View style={vnStyles.waveRow}>
          {WAVE.map((h, i) => {
            const isPast = i / WAVE.length <= progress;
            return (
              <Animated.View key={i} style={[
                vnStyles.bar,
                {
                  height: playing ? h : Math.max(h * 0.5, 3),
                  backgroundColor: isPast ? C.gold : C.primary,
                  opacity: playing
                    ? animRef.interpolate({ inputRange: [0, 1], outputRange: [0.5 + (i % 4) * 0.12, 1] })
                    : isPast ? 0.85 : 0.4,
                },
              ]} />
            );
          })}
        </View>
        <Text style={vnStyles.timeText}>{playing ? fmtTime(elapsed) : fmtTime(durationSec)}</Text>
      </View>
    </View>
  );
};

const vnStyles = StyleSheet.create({
  container:  { backgroundColor: C.surfaceHigh, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: C.border },
  hintRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  hintDot:    { fontSize: 6, color: C.gold },
  hintText:   { fontSize: 10.5, color: C.sub, fontStyle: 'italic', letterSpacing: 0.2 },
  playerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4 },
  playIcon:   { fontSize: 14, color: '#fff' },
  waveRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 },
  bar:        { flex: 1, borderRadius: 2, maxWidth: 4 },
  timeText:   { fontSize: 11, color: C.sub, minWidth: 30, textAlign: 'right' },
});

// ─── Icons ────────────────────────────────────────────────────
const Ico = {
  Heart:    ({ filled }: { filled?: boolean }) =>
    <Text style={{ fontSize: 24, color: filled ? C.like : C.text }}>{filled ? '❤️' : '🤍'}</Text>,
  Comment:  () => <Text style={{ fontSize: 22, color: C.text }}>💬</Text>,
  Share:    () => <Text style={{ fontSize: 22, color: C.text }}>➤</Text>,
  Bookmark: ({ filled }: { filled?: boolean }) =>
    <Text style={{ fontSize: 22, color: C.text }}>{filled ? '🔖' : '📄'}</Text>,
  More:     () => <Text style={{ fontSize: 20, color: C.sub, letterSpacing: 2 }}>•••</Text>,
  Lock:     () => <Text style={{ fontSize: 34 }}>🔒</Text>,
  Plus:     () => <Text style={{ fontSize: 22, color: '#fff', lineHeight: 24 }}>+</Text>,
  Cross:    () => <Text style={{ fontSize: 11, color: C.muted }}>✕</Text>,
};

// ─── SA Flag Background ───────────────────────────────────────
// Image credit: "Flag of South Africa", Government of South Africa.
// Public domain. Via Wikimedia Commons:
// https://upload.wikimedia.org/wikipedia/commons/a/af/Flag_of_South_Africa.svg
const SA_FLAG_URI =
  'https://upload.wikimedia.org/wikipedia/commons/a/af/Flag_of_South_Africa.svg';

// ─── Universal Background Image ───────────────────────────────
// React Native's <Image> does NOT support SVG URLs natively.
// This component detects SVGs and renders them via react-native-svg's
// SvgUri, falling back to a regular <Image> for all raster formats
// (PNG, JPG, WebP, GIF, etc.) — so any URL you pass in will work.
//
// Install once if not already in your project:
//   npx expo install react-native-svg
//
interface UniversalBgImageProps {
  uri: string;
  opacity?: number;
}
const UniversalBgImage: React.FC<UniversalBgImageProps> = ({ uri, opacity = 0.12 }) => {
  // Detect SVG by extension or by common SVG CDN patterns (e.g. Wikimedia)
  const isSvg =
    /\.svg(\?.*)?$/i.test(uri) ||
    uri.includes('wikipedia.org') ||
    uri.includes('wikimedia.org');

  if (isSvg) {
    // Lazily require SvgUri so the app doesn't crash if react-native-svg
    // isn't installed — it'll just show nothing, same as before.
    let SvgUri: React.ComponentType<{ uri: string; width: string | number; height: string | number }> | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      SvgUri = require('react-native-svg').SvgUri;
    } catch (_) {
      // react-native-svg not installed — silently skip
    }
    if (!SvgUri) return null;
    return (
      <View style={[flagStyles.container, { opacity }]} pointerEvents="none">
        <SvgUri uri={uri} width="100%" height="100%" />
      </View>
    );
  }

  // Raster image (PNG, JPG, WebP, GIF, …)
  return (
    <View style={[flagStyles.container, { opacity }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={flagStyles.image}
        resizeMode="cover"
      />
    </View>
  );
};

const SAFlagBackground: React.FC = () => (
  <UniversalBgImage uri={SA_FLAG_URI} opacity={0.12} />
);

const flagStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  image:     { width: '100%', height: '100%' },
});

// ─── Locked Overlay ───────────────────────────────────────────
const LockedOverlay: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => (
  <View style={styles.lockedOverlay}>
    <View style={styles.lockedIconWrap}><Ico.Lock /></View>
    <Text style={styles.lockedTitle}>Pro Members Only</Text>
    <Text style={styles.lockedSub}>Upgrade to unlock exclusive content</Text>
    <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85} style={styles.lockedBtn}>
      <Text style={styles.lockedBtnText}>Upgrade to Pro  →</Text>
    </TouchableOpacity>
  </View>
);

// ─── Post Card (Firebase-wired) ───────────────────────────────
// Uses usePost() for real-time like count + liked state.
// The Post type from Firestore uses `media[]` for images.
interface PostCardProps {
  post: Post;
  onUpgrade: () => void;
}
const PostCard: React.FC<PostCardProps> = ({ post, onUpgrade }) => {
  // Real-time likes from Firestore via usePost hook
  const { liked, likesCount, toggleLike: handleToggleLike } = usePost(post.id);

  // Subscription gate — posts with requiredTier need a matching plan
  const { tier } = useSubscription();
  const isLocked = !!(
    (post as any).requiredTier &&
    (post as any).requiredTier !== 'free' &&
    tier === 'free'
  );

  // Saved state is local-only until a bookmarks service is added
  const [saved, setSaved] = useState(false);
  const lastTap = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked && !isLocked) handleToggleLike();
    lastTap.current = now;
  }, [liked, isLocked, handleToggleLike]);

  // Resolve image — post.media is MediaItem[]
  const firstMedia = post.media?.[0];
  const imageUri   = firstMedia?.url ?? 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800';

  // Resolve author display (author may be denormalised or looked up separately)
  const authorName = (post as any).authorUsername ?? (post as any).authorId ?? 'unknown';
  const authorAvatar = (post as any).authorAvatar ?? `https://i.pravatar.cc/150?u=${post.authorId}`;
  const location = post.location
    ? `${post.location.city ?? ''}${post.location.country ? ', ' + post.location.country : ''}`.trim()
    : null;

  const timeAgo = (() => {
    if (!post.createdAt) return '';
    const ts = (post.createdAt as any).toDate?.() ?? new Date(post.createdAt as any);
    const diff = Date.now() - ts.getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return `${Math.floor(diff / 60_000)}m`;
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  })();

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <Image source={{ uri: authorAvatar }} style={styles.postAvatar} />
        <View style={styles.postHeaderText}>
          <Text style={styles.postUsername}>{authorName}</Text>
          {location ? <Text style={styles.postLocation}>{location}</Text> : null}
        </View>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ico.More />
        </TouchableOpacity>
      </View>

      {/* Image */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.postImageWrap}>
          <Image
            source={{ uri: imageUri }}
            style={styles.postImage}
            blurRadius={isLocked ? 18 : 0}
          />
          {isLocked && <LockedOverlay onUpgrade={onUpgrade} />}
        </View>
      </TouchableWithoutFeedback>

      {/* Voice Note — stored as type === 'voice' media item */}
      {post.type === 'reel' && firstMedia?.url && (
        <VoiceNotePlayer
          uri={firstMedia.url}
          durationSec={firstMedia.duration ?? 30}
          isLocked={isLocked}
        />
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity
            onPress={() => { if (!isLocked) handleToggleLike(); }}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ico.Heart filled={liked} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ico.Comment />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ico.Share />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setSaved(s => !s)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ico.Bookmark filled={saved} />
        </TouchableOpacity>
      </View>

      {/* Meta */}
      <View style={styles.postMeta}>
        <Text style={styles.postLikes}>{likesCount.toLocaleString()} likes</Text>
        <Text style={styles.postCaption} numberOfLines={2}>
          <Text style={styles.postCaptionUsername}>{authorName} </Text>
          {post.caption}
        </Text>
        <Text style={styles.postComments}>View all {post.commentsCount} comments</Text>
        <Text style={styles.postTime}>{timeAgo} ago</Text>
      </View>
    </View>
  );
};

// ─── Brand Carousel Card ──────────────────────────────────────
interface BrandCarouselCardProps {
  brand: Brand;
  onPress: () => void;
}
const BrandCarouselCard: React.FC<BrandCarouselCardProps> = ({ brand, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { subscribed, toggle } = useBrandSubscription(brand.id);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={[bStyles.card, { transform: [{ scale: scaleAnim }] }]}>
        {brand.coverUrl
          ? <Image source={{ uri: brand.coverUrl }} style={bStyles.coverImg} />
          : <View style={[bStyles.coverImg, { backgroundColor: brand.primaryColor || '#1a0e09' }]} />
        }
        <View style={bStyles.cardOverlay} />
        {brand.isLive && (
          <View style={bStyles.liveBadge}>
            <Text style={bStyles.liveText}>● LIVE</Text>
          </View>
        )}
        <View style={bStyles.cardBottom}>
          {brand.logoUrl
            ? <Image source={{ uri: brand.logoUrl }} style={bStyles.logo} />
            : <View style={[bStyles.logo, { backgroundColor: brand.primaryColor || C.primaryDk, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 18 }}>🏷</Text>
              </View>
          }
          <View style={bStyles.cardInfo}>
            <Text style={bStyles.cardName} numberOfLines={1}>{brand.name}</Text>
            <Text style={bStyles.cardTagline} numberOfLines={1}>{brand.tagline}</Text>
          </View>
          {/* Subscribe hint — tappable */}

            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); toggle(); }}
              style={[bStyles.subHint, subscribed && bStyles.subHintActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              
              <Text style={bStyles.subHintIcon}>{subscribed ? '🔔' : '+'}</Text>

            </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CARD_WIDTH  = SCREEN_WIDTH * 0.62;
const CARD_HEIGHT = CARD_WIDTH * 1.42;

const bStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 18,
    overflow: 'hidden', backgroundColor: C.surface, marginRight: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  coverImg:      { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  cardOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: 'rgba(13,8,6,0.85)' },
  liveBadge:     { position: 'absolute', top: 12, right: 12, backgroundColor: C.like, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveText:      { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardBottom:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 16, paddingTop: 10, gap: 10 },
  logo:          { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.gold },
  cardInfo:      { flex: 1 },
  cardName:      { fontSize: 15, fontWeight: '800', color: C.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.3 },
  cardTagline:   { fontSize: 10, color: C.goldLt, letterSpacing: 1.2, marginTop: 2 },
  subHint:       { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primaryDk, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  subHintActive: { backgroundColor: C.gold },
  subHintIcon:   { fontSize: 14, color: '#fff' },
});

// ─── Brand Carousel ───────────────────────────────────────────
interface BrandCarouselProps {
  onBrandPress: (brand: Brand) => void;
}
const BrandCarousel: React.FC<BrandCarouselProps> = ({ onBrandPress }) => {
  const { brands, loading } = useBrands();
  const user  = useAuth().userProfile;

  return (user &&(
    <View style={carStyles.section}>
      <View style={carStyles.header}>
        <View>
          <Text style={carStyles.sectionLabel}>✦ BRANDS</Text>
          {/* <Text style={carStyles.sectionTitle}>Subscribed Brands</Text> */}
        </View>
        <TouchableOpacity>
          <Text style={carStyles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : brands.length === 0 ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 13 }}>No brands yet</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={carStyles.scrollContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 14}
          snapToAlignment="start"
        >
          {brands
          .filter(brand => brand.id !== user.uid)
          .map(brand => (
            <BrandCarouselCard key={brand.id} brand={brand} onPress={() => onBrandPress(brand)} />
          ))}
        </ScrollView>
      )}
    </View>
  ));
};

const carStyles = StyleSheet.create({
  section:       { marginTop: 16, marginBottom: 8 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 14 },
  sectionLabel:  { fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: '700', marginBottom: 3 },
  sectionTitle:  { fontSize: 20, fontWeight: '800', color: C.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  seeAll:        { fontSize: 12, color: C.primary, fontWeight: '600' },
  scrollContent: { paddingLeft: 16, paddingRight: 8 },
});

// ─── Brand Screen ─────────────────────────────────────────────
interface BrandScreenProps {
  brand: Brand;
  onBack: () => void;
}
export const BrandScreen: React.FC<BrandScreenProps> = ({ brand, onBack }) => {
  const { subscribed, toggle: toggleSub } = useBrandSubscription(brand.id);
  const [donated, setDonated] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const heroHeight = scrollY.interpolate({
    inputRange: [0, 200], outputRange: [SCREEN_HEIGHT * 0.46, SCREEN_HEIGHT * 0.22], extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 150], outputRange: [1, 0.3], extrapolate: 'clamp',
  });

  // Posts wired to Firestore — use useBrandPosts(brand.id) to populate
  const brandPosts: { id: string; image: string; likes: number }[] = [];
  const col1 = brandPosts.filter((_, i) => i % 2 === 0);
  const col2 = brandPosts.filter((_, i) => i % 2 === 1);

  return (
    <View style={brandStyles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[brandStyles.hero, { height: heroHeight }]}>
        {brand.coverUrl
          ? <Image source={{ uri: brand.coverUrl }} style={brandStyles.heroBg} />
          : <View style={[brandStyles.heroBg, { backgroundColor: brand.primaryColor || C.primaryDk }]} />
        }
        <View style={brandStyles.heroOverlay} />

        {brand.isLive && (
          <View style={brandStyles.liveBar}>
            <View style={brandStyles.liveDot} />
            <Text style={brandStyles.liveBarText}>LIVE  ·  {brand.liveViewers.toLocaleString()} watching</Text>
            <TouchableOpacity style={brandStyles.shareBtn}>
              <Text style={brandStyles.shareBtnText}>↗ Share</Text>
            </TouchableOpacity>
          </View>
        )}

        {brand.isLive && (
          <View style={brandStyles.mediaControls}>
            <TouchableOpacity style={brandStyles.mediaBtn}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⏸</Text>
            </TouchableOpacity>
            <TouchableOpacity style={brandStyles.mediaBtn}>
              <Text style={{ color: '#fff', fontSize: 18 }}>🔊</Text>
            </TouchableOpacity>
          </View>
        )}

        {brand.isLive && (
          <Animated.View style={[brandStyles.viewerRow, { opacity: heroOpacity }]}>
            {[11, 12, 13, 14, 15].map((n, i) => (
              <Image key={n} source={{ uri: `https://i.pravatar.cc/40?img=${n}` }}
                style={[brandStyles.viewerAvatar, { marginLeft: i === 0 ? 0 : -10 }]} />
            ))}
            <Text style={brandStyles.viewerCountText}>+{Math.max(0, brand.liveViewers - 5).toLocaleString()}</Text>
          </Animated.View>
        )}

        <TouchableOpacity style={brandStyles.backBtn} onPress={onBack}>
          <Text style={{ fontSize: 22, color: '#fff' }}>←</Text>
        </TouchableOpacity>
        <View style={brandStyles.eyeBtn}>
          <Text style={{ fontSize: 18, color: '#fff' }}>👁</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={brandStyles.body}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <View style={brandStyles.infoSection}>
          <View style={brandStyles.subscribedRow}>
            {brand.logoUrl
              ? <Image source={{ uri: brand.logoUrl }} style={brandStyles.subscribedAvatar} />
              : <View style={[brandStyles.subscribedAvatar, { backgroundColor: brand.primaryColor || C.primaryDk }]} />
            }
            <Text style={brandStyles.subscribedText}>
              {brand.subscribersCount.toLocaleString()} SUBSCRIBERS
            </Text>
            <TouchableOpacity
              onPress={toggleSub}
              style={[brandStyles.followBtn, subscribed && brandStyles.followBtnActive]}
            >
              <Text style={[brandStyles.followBtnText, subscribed && { color: C.text }]}>
                {subscribed ? 'Following' : 'follow'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={brandStyles.brandName}>{brand.name}</Text>
          <Text style={brandStyles.brandTagline}>{brand.tagline}</Text>
          <Text style={brandStyles.brandBio}>{brand.bio}</Text>

          <View style={brandStyles.fontRow}>
            {brand.fonts.map(f => (
              <View key={f} style={brandStyles.fontTag}>
                <Text style={brandStyles.fontTagText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={brandStyles.actionsRow}>
            <TouchableOpacity style={brandStyles.subscribeBtn} onPress={toggleSub}>
              <View style={brandStyles.subscribeBtnInner}>
                <Text style={{ fontSize: 16 }}>🔔</Text>
                <Text style={brandStyles.subscribeBtnText}>{subscribed ? 'Subscribed ✓' : 'SUBSCRIBE'}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[brandStyles.donateBtn, donated && brandStyles.donateBtnActive]}
              onPress={() => setDonated(d => !d)}
            >
              <Text style={brandStyles.donateBtnText}>{donated ? '✦ Donated!' : 'DONATE'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={brandStyles.divider} />

        <View style={brandStyles.gridHeader}>
          <Text style={brandStyles.gridLabel}>✦ POSTS</Text>
          <Text style={brandStyles.gridCount}>{brand.postsCount} posts</Text>
        </View>

        <View style={brandStyles.grid}>
          <View style={brandStyles.gridCol}>
            {col1.map(p => (
              <TouchableOpacity key={p.id} activeOpacity={0.85} style={brandStyles.gridItem}>
                <Image source={{ uri: p.image }} style={brandStyles.gridImage} />
                <View style={brandStyles.gridItemOverlay}>
                  <Text style={brandStyles.gridLikes}>❤ {p.likes.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[brandStyles.gridCol, { marginTop: 28 }]}>
            {col2.map(p => (
              <TouchableOpacity key={p.id} activeOpacity={0.85} style={brandStyles.gridItem}>
                <Image source={{ uri: p.image }} style={brandStyles.gridImage} />
                <View style={brandStyles.gridItemOverlay}>
                  <Text style={brandStyles.gridLikes}>❤ {p.likes.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const brandStyles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  hero:    { width: '100%', overflow: 'hidden' },
  heroBg:  { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,8,6,0.45)' },
  liveBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10, gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.like },
  liveBarText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  shareBtn:    { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shareBtnText:{ color: '#fff', fontSize: 11, fontWeight: '600' },
  mediaControls: { position: 'absolute', bottom: 48, left: '50%', transform: [{ translateX: -36 }], flexDirection: 'row', gap: 16 },
  mediaBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  viewerRow: { position: 'absolute', bottom: 12, left: 16, flexDirection: 'row', alignItems: 'center' },
  viewerAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.bg },
  viewerCountText: { marginLeft: 6, color: C.textSub, fontSize: 12, fontWeight: '600' },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 36, left: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  eyeBtn:  { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 36, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, backgroundColor: C.bg },
  infoSection: { padding: 16, paddingTop: 14 },
  subscribedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  subscribedAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.gold },
  subscribedText:   { flex: 1, fontSize: 10, color: C.sub, letterSpacing: 0.5 },
  followBtn:        { borderWidth: 1.5, borderColor: C.primaryLt, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  followBtnActive:  { backgroundColor: C.primaryDk, borderColor: C.primaryDk },
  followBtnText:    { color: C.primaryLt, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  brandName:        { fontSize: 30, fontWeight: '800', color: C.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.5, marginBottom: 2 },
  brandTagline:     { fontSize: 11, color: C.gold, letterSpacing: 2, fontWeight: '700', marginBottom: 10 },
  brandBio:         { fontSize: 13.5, color: C.textSub, lineHeight: 21, marginBottom: 12 },
  fontRow:          { flexDirection: 'row', gap: 8, marginBottom: 18 },
  fontTag:          { borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: C.surfaceHigh },
  fontTagText:      { fontSize: 11, color: C.sub, letterSpacing: 1, fontWeight: '600' },
  actionsRow:       { flexDirection: 'row', gap: 10 },
  subscribeBtn:     { flex: 1, backgroundColor: C.gold, borderRadius: 12, overflow: 'hidden' },
  subscribeBtnInner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 8 },
  subscribeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  donateBtn:        { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  donateBtnActive:  { backgroundColor: C.primaryDk, borderColor: C.primaryDk },
  donateBtnText:    { color: C.primaryLt, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  divider:          { height: 1, backgroundColor: C.border, marginHorizontal: 16, marginVertical: 4 },
  gridHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  gridLabel:        { fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: '700' },
  gridCount:        { fontSize: 12, color: C.sub },
  grid:             { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  gridCol:          { flex: 1, gap: 8 },
  gridItem:         { borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  gridImage:        { width: '100%', aspectRatio: 0.85, resizeMode: 'cover' },
  gridItemOverlay:  { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(13,8,6,0.65)' },
  gridLikes:        { fontSize: 11, color: C.textSub, fontWeight: '600' },
});

// ─── Feed Screen ──────────────────────────────────────────────
// Drives FlatList from useFeed() — paginated, pull-to-refresh,
// infinite scroll, real-time per-post likes via usePost().
interface FeedScreenProps {
  onNavigateToSubscription: () => void;
  onNavigateToBrand: (brand: Brand) => void;
}
export default function FeedScreen({ onNavigateToSubscription, onNavigateToBrand }: FeedScreenProps) {
  const { posts, loading, loadingMore, hasMore, refresh, loadMore } = useFeed();
  const { userProfile } = useAuth();

  // Brand carousel above feed posts (rendered as FlatList ListHeaderComponent)
  const ListHeader = (
    <View>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navBrand}>{userProfile?.username ?? 'Feed'}</Text>
        <View style={styles.navActions} />
      </View>
      <View style={styles.divider} />
      {/* Brand carousel */}
      <BrandCarousel onBrandPress={onNavigateToBrand} />
      <View style={styles.divider} />
    </View>
  );

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onUpgrade={onNavigateToSubscription} />
    ),
    [onNavigateToSubscription]
  );

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={{ color: C.sub, marginTop: 12, fontSize: 13 }}>Loading feed…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SAFlagBackground />
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        // Pull to refresh
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        // Infinite scroll — load next page when near bottom
        onEndReached={() => { if (hasMore && !loadingMore) loadMore(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore
            ? <View style={styles.loader}><ActivityIndicator color={C.primary} /></View>
            : !hasMore
            ? <View style={styles.loader}><Text style={{ color: C.muted, fontSize: 12 }}>You're all caught up ✦</Text></View>
            : null
        }
        // Performance
        removeClippedSubviews
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </View>
  );
};

// ─── Subscription Plans ───────────────────────────────────────
const PLANS = [
  {
    id: 'free', name: 'Free', price: 0,
    color: C.muted, accent: C.sub, tag: null,
    features: ['10 posts per day', '5 stories per day', '1-min reels', 'Basic explore'],
    missing: ['Analytics', 'Scheduling', 'Content gating'],
  },
  {
    id: 'basic', name: 'Basic', price: 4.99,
    color: C.primaryDk, accent: C.primary, tag: null,
    features: ['50 posts per day', '20 stories per day', '3-min reels', 'Basic analytics'],
    missing: ['Scheduling', 'Content gating'],
  },
  {
    id: 'pro', name: 'Pro', price: 9.99,
    color: C.primary, accent: C.primaryLt, tag: 'MOST POPULAR',
    features: ['100 posts per day', '50 stories per day', '10-min reels', 'Advanced analytics', 'Post scheduling', 'Content gating', 'Swipe-up links'],
    missing: ['Verified badge'],
  },
  {
    id: 'creator', name: 'Creator', price: 19.99,
    color: C.gold, accent: C.goldLt, tag: 'BEST VALUE',
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
    <View style={[
      styles.planCard,
      isCurrent && { borderColor: plan.accent, shadowColor: plan.color, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },
    ]}>
      {plan.tag && (
        <View style={[styles.planTag, { backgroundColor: plan.color }]}>
          <Text style={styles.planTagText}>{plan.tag}</Text>
        </View>
      )}
      <View style={styles.planHeader}>
        <View>
          <Text style={[styles.planName, isCurrent && { color: plan.accent }]}>{plan.name}</Text>
          {billing === 'yearly' && plan.price > 0 && (
            <Text style={[styles.planSave, { color: plan.accent }]}>Save 17% yearly</Text>
          )}
        </View>
        <View style={styles.planPriceWrap}>
          {plan.price === 0
            ? <Text style={[styles.planPrice, { color: C.muted }]}>Free</Text>
            : <>
                <Text style={[styles.planPrice, { color: plan.accent }]}>R{price}</Text>
                <Text style={styles.planPeriod}>{billing === 'yearly' ? '/yr' : '/mo'}</Text>
              </>
          }
        </View>
      </View>
      <View style={[styles.planDivider, { backgroundColor: plan.color + '40' }]} />
      {plan.features.map((f, i) => (
        <View key={i} style={styles.planFeatureRow}>
          <View style={[styles.planFeatureIcon, { backgroundColor: plan.color + '30' }]}>
            <Text style={{ fontSize: 11, color: plan.accent }}>✓</Text>
          </View>
          <Text style={styles.planFeatureText}>{f}</Text>
        </View>
      ))}
      {plan.missing.map((f, i) => (
        <View key={i} style={[styles.planFeatureRow, { opacity: 0.3 }]}>
          <View style={styles.planFeatureIconMissing}>
            <Text style={{ fontSize: 11, color: C.muted }}>✕</Text>
          </View>
          <Text style={[styles.planFeatureText, { color: C.muted }]}>{f}</Text>
        </View>
      ))}
      <TouchableOpacity onPress={() => onSelect(plan.id)} activeOpacity={plan.price === 0 ? 1 : 0.85} style={styles.planBtnWrap}>
        {isCurrent
          ? <View style={[styles.planBtn, { backgroundColor: plan.color + '22', borderWidth: 1.5, borderColor: plan.accent }]}>
              <Text style={[styles.planBtnTextActive, { color: plan.accent }]}>✦ Current Plan</Text>
            </View>
          : plan.price > 0
            ? <View style={[styles.planBtn, { backgroundColor: plan.color }]}>
                <Text style={styles.planBtnTextActive}>Get {plan.name}  →</Text>
              </View>
            : <View style={styles.planBtnOutline}>
                <Text style={styles.planBtnTextOutline}>Free Forever</Text>
              </View>
        }
      </TouchableOpacity>
    </View>
  );
};

interface SubscriptionScreenProps { onBack?: () => void; }
export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onBack }) => {
  const [billing, setBilling]         = useState<'monthly' | 'yearly'>('monthly');
  // Seed currentPlan from the real subscription hook
  const { tier } = useSubscription();
  const [currentPlan, setCurrentPlan] = useState(tier);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);

  // Keep currentPlan in sync if tier changes (e.g. after purchase)
  useEffect(() => { setCurrentPlan(tier); }, [tier]);

  const handleSelect  = (id: string) => { if (id !== currentPlan && id !== 'free') setConfirmPlan(id); };
  const handleConfirm = () => { if (confirmPlan) setCurrentPlan(confirmPlan as typeof tier); setConfirmPlan(null); };
  const confirmPlanData = PLANS.find(p => p.id === confirmPlan);

  return (
    <ScrollView style={styles.screen}>
      <SAFlagBackground />
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.subHero}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
              <Text style={{ color: C.primary, fontSize: 15, fontWeight: '600' }}>← Back</Text>
            </TouchableOpacity>
          )}
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>✦ UNLOCK YOUR POTENTIAL</Text>
          </View>
          <Text style={styles.subTitle}>Create without{'\n'}limits</Text>
          <Text style={styles.subDesc}>Choose the plan that fits your creative journey</Text>
          <View style={styles.billingToggle}>
            {(['monthly', 'yearly'] as const).map(b => (
              <TouchableOpacity
                key={b} onPress={() => setBilling(b)}
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
        </View>
        <View style={styles.plansContainer}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id} plan={plan}
              isCurrent={plan.id === currentPlan}
              billing={billing} onSelect={handleSelect}
            />
          ))}
          <Text style={styles.subFooter}>
            Subscriptions renew automatically. Cancel anytime in settings.{'\n'}
            iOS billing via App Store · Android via Google Play
          </Text>
        </View>
      
      {confirmPlan && confirmPlanData && (
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback onPress={() => setConfirmPlan(null)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Upgrade to {confirmPlanData.name}</Text>
            <Text style={styles.sheetPrice}>
              R{billing === 'yearly'
                ? (confirmPlanData.price * 10).toFixed(2) + '/year'
                : confirmPlanData.price.toFixed(2) + '/month'} · Cancel anytime
            </Text>
            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85} style={{ marginBottom: 12 }}>
              <View style={[styles.sheetConfirmBtn, { backgroundColor: confirmPlanData.color }]}>
                <Text style={styles.sheetConfirmText}>Confirm Upgrade</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmPlan(null)} style={styles.sheetCancelBtn}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// ─── Shared Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 10,
    backgroundColor: C.bg,
  },
  navBrand: {
    fontSize: 26, fontWeight: '800', color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.5,
  },
  navActions: { flexDirection: 'row', gap: 16 },
  divider:    { height: 1, backgroundColor: C.border },

  // Post card
  postCard:            { backgroundColor: C.surface, marginBottom: 1, borderBottomWidth: 1, borderBottomColor: C.border },
  postHeader:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  postAvatar:          { width: 36, height: 36, borderRadius: 18 },
  postHeaderText:      { flex: 1 },
  postUsername:        { fontSize: 13.5, fontWeight: '700', color: C.text },
  postLocation:        { fontSize: 11.5, color: C.sub, marginTop: 1 },
  postImageWrap:       { position: 'relative', backgroundColor: '#110a06' },
  postImage:           { width: SCREEN_WIDTH, height: SCREEN_WIDTH, resizeMode: 'cover' },
  lockedOverlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,8,6,0.82)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  lockedIconWrap:      { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primaryDk + '60', borderWidth: 1, borderColor: C.primary + '50', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle:         { fontSize: 16, fontWeight: '700', color: C.text },
  lockedSub:           { fontSize: 13, color: C.sub, marginBottom: 8 },
  lockedBtn:           { backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  lockedBtnText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  postActions:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  postActionsLeft:     { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn:           { padding: 2 },
  postMeta:            { paddingHorizontal: 14, paddingBottom: 14 },
  postLikes:           { fontSize: 13.5, fontWeight: '700', color: C.text, marginBottom: 4 },
  postCaption:         { fontSize: 13.5, color: C.textSub, lineHeight: 20, marginBottom: 4 },
  postCaptionUsername: { fontWeight: '700', color: C.text },
  postComments:        { fontSize: 13, color: C.sub, marginBottom: 3 },
  postTime:            { fontSize: 11, color: C.muted },
  loader:              { padding: 24, alignItems: 'center' },

  // Subscription
  subHero:             { paddingTop: Platform.OS === 'ios' ? 64 : 28, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  subBadge:            { backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold + '50', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 16 },
  subBadgeText:        { color: C.goldLt, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  subTitle:            { fontSize: 34, fontWeight: '800', color: C.text, textAlign: 'center', lineHeight: 40, marginBottom: 10, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  subDesc:             { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  billingToggle:       { flexDirection: 'row', backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border, borderRadius: 30, padding: 3 },
  billingOption:       { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  billingOptionActive: { backgroundColor: C.primaryDk + '60' },
  billingText:         { fontSize: 13, fontWeight: '600', color: C.muted },
  billingTextActive:   { color: C.text },
  billingBadge:        { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  billingBadgeText:    { color: '#fff', fontSize: 9, fontWeight: '800' },
  plansContainer:      { padding: 16, gap: 16 },
  planCard:            { backgroundColor: C.surface, borderRadius: 20, borderWidth: 2, borderColor: C.border, padding: 20, position: 'relative', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  planTag:             { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: 12 },
  planTagText:         { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  planHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName:            { fontSize: 22, fontWeight: '800', color: C.text },
  planSave:            { fontSize: 11, fontWeight: '600', marginTop: 2 },
  planPriceWrap:       { alignItems: 'flex-end' },
  planPrice:           { fontSize: 28, fontWeight: '800', color: C.text },
  planPeriod:          { fontSize: 12, color: C.sub, marginTop: 2 },
  planDivider:         { height: 1, marginBottom: 14 },
  planFeatureRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planFeatureIcon:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planFeatureIconMissing: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  planFeatureText:     { fontSize: 13.5, color: C.textSub, flex: 1 },
  planBtnWrap:         { marginTop: 16 },
  planBtn:             { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  planBtnTextActive:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  planBtnOutline:      { borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  planBtnTextOutline:  { fontWeight: '700', fontSize: 14, color: C.muted },
  subFooter:           { textAlign: 'center', fontSize: 11.5, color: C.muted, lineHeight: 18, paddingHorizontal: 16, marginTop: 8 },

  // Bottom sheet
  sheetBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end', zIndex: 100 },
  sheet:            { backgroundColor: C.surfaceHigh, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, borderTopWidth: 1, borderColor: C.border },
  sheetHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: C.muted, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:       { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 6 },
  sheetPrice:       { fontSize: 14, color: C.sub, marginBottom: 24 },
  sheetConfirmBtn:  { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  sheetConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sheetCancelBtn:   { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  sheetCancelText:  { color: C.sub, fontWeight: '600', fontSize: 14 },
});
