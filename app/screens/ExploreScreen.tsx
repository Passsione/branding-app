// ============================================================
// app/screens/ExploreScreen.tsx
// Search brands by name/category + trending posts grid
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ScrollView, Dimensions, Animated,
  ActivityIndicator, SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useBrands, useBrandSubscription } from '../../hooks/brandHooks';
import { useAuth }  from '../../hooks/index';
import { Brand } from '../../services/brandService';
import { getExplorePosts } from '../../services/postService';
import { Post } from '../../types';

const { width: SW } = Dimensions.get('window');

// ── Design tokens (matches rest of app) ──────────────────────
const C = {
  bg:          '#0d0806',
  surface:     '#120a07',
  surfaceHigh: '#1c100a',
  border:      '#2e1a0e',
  text:        '#f5ede6',
  sub:         '#9e7e6a',
  muted:       '#4a3328',
  primary:     '#9B5035',
  primaryDk:   '#7D3F2A',
  primaryLt:   '#B8704E',
  gold:        '#C8901A',
  goldLt:      '#E8A820',
  like:        '#c0443a',
  green:       '#5a9e6a',
};

const CATEGORIES = ['All', 'Fashion', 'Design', 'Photography', 'Motion', 'Branding', 'Illustration', 'Typography'];
const GRID_COLS  = 3;
const GRID_GAP   = 2;
const TILE_SIZE  = (SW - (GRID_COLS + 1) * GRID_GAP) / GRID_COLS;

// ── Brand search result card ──────────────────────────────────
const BrandCard: React.FC<{ brand: Brand; onPress: (b: Brand) => void }> = ({ brand, onPress }) => {
  const { subscribed, toggle } = useBrandSubscription(brand.id);
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <TouchableOpacity
      onPress={() => onPress(brand)}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[s.brandCard, { transform: [{ scale }] }]}>
        {/* Cover strip */}
        <View style={s.brandCardCover}>
          {brand.coverUrl
            ? <Image source={{ uri: brand.coverUrl }} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: brand.primaryColor || C.primaryDk }]} />
          }
          <LinearGradient
            colors={[brand.primaryColor + '10' || 'transparent', brand.secondaryColor + '70'|| 'rgba(13,8,6,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          {brand.isLive && (
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Logo + info row */}
        <View style={s.brandCardBody}>
          <View style={s.brandLogoWrap}>
            {brand.logoUrl
              ? <Image source={{ uri: brand.logoUrl }} style={s.brandLogo} />
              : <View style={[s.brandLogo, { backgroundColor: brand.primaryColor || C.primaryDk, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 16 }}>🏷</Text>
                </View>
            }
            {brand.isVerified && (
              <View style={s.verifiedDot}>
                <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800' }}>✓</Text>
              </View>
            )}
          </View>

          <View style={s.brandCardInfo}>
            <Text style={s.brandCardName} numberOfLines={1}>{brand.name}</Text>
            <Text style={s.brandCardCat} numberOfLines={1}>{brand.category}</Text>
            <Text style={s.brandCardSubs}>{brand.subscribersCount.toLocaleString()} subscribers</Text>
          </View>

          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); toggle(); }}
            style={[s.subBtn, subscribed && s.subBtnActive]}
          >
            <Text style={[s.subBtnText, subscribed && s.subBtnTextActive]}>
              {subscribed ? 'Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Post grid tile ────────────────────────────────────────────
const GridTile: React.FC<{ post: Post; onPress: () => void }> = ({ post, onPress }) => {
  const img = post.media?.[0]?.url;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.tile}>
      {img
        ? <Image source={{ uri: img }} style={s.tileImage} />
        : <View style={[s.tileImage, { backgroundColor: C.surface }]} />
      }
      {post.type === 'video' && (
        <View style={s.tilePlayBadge}>
          <Text style={{ color: '#fff', fontSize: 10 }}>▶</Text>
        </View>
      )}
      {post.type === 'carousel' && (
        <View style={s.tileMultiBadge}>
          <Text style={{ color: '#fff', fontSize: 9 }}>⧉</Text>
        </View>
      )}
      {/* Like count overlay on hover-ish — show for posts with many likes */}
      {post.likesCount > 50 && (
        <View style={s.tileLikes}>
          <Text style={s.tileLikesText}>❤ {post.likesCount >= 1000 ? (post.likesCount / 1000).toFixed(1) + 'k' : post.likesCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Main ExploreScreen ────────────────────────────────────────
interface ExploreScreenProps {
  onNavigateToBrand: (brand: Brand) => void;
}

export default function ExploreScreen({ onNavigateToBrand }: ExploreScreenProps) {
  const { brands, loading: brandsLoading } = useBrands();
  const [explorePosts, setExplorePosts]    = useState<Post[]>([]);
  const [postsLoading, setPostsLoading]    = useState(true);

  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');
  const [tab,      setTab]      = useState<'brands' | 'posts'>('brands');
  const searchFocused = useRef(false);
  const user  = useAuth().userProfile;

  // load trending posts once
  useEffect(() => {
    getExplorePosts(30)
      .then(setExplorePosts)
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, []);

  // filtered brands
  const filteredBrands = brands.filter(b => {
    const q       = search.toLowerCase();    
    const matchQ  = !q || b.name.toLowerCase().includes(q) || b.handle.toLowerCase().includes(q) || b.tagline?.toLowerCase().includes(q);
    const matchCat = category === 'All' || b.category === category;

    return matchQ && matchCat && b.id !== user?.uid;
  });

  // filtered posts
  const filteredPosts = explorePosts.filter(p => {
    const q = search.toLowerCase();
    return !q || p.caption?.toLowerCase().includes(q) || p.tags?.some(t => t.includes(q));
  });

  const headerAnim = useRef(new Animated.Value(0)).current;

  const onSearchFocus = () => {
    searchFocused.current = true;
    Animated.timing(headerAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onSearchBlur = () => {
    if (!search) {
      searchFocused.current = false;
      Animated.timing(headerAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  };

  const headerHeight = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [56, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Collapsing title */}
      <Animated.View style={[s.titleBar, { height: headerHeight, overflow: 'hidden' }]}>
        <Text style={s.titleLabel}>✦ DISCOVER</Text>
        <Text style={s.titleText}>Explore</Text>
      </Animated.View>

      {/* Search bar */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            placeholder="Search brands, posts, tags…"
            placeholderTextColor={C.muted}
            style={s.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: C.sub, fontSize: 15, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {(['brands', 'posts'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === 'brands' ? '🏷  Brands' : '⊞  Posts'}
            </Text>
            {tab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Category pills — brands only */}
      {tab === 'brands' && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={s.pillsScroll} contentContainerStyle={s.pillsContent}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[s.pill, category === cat && s.pillActive]}
            >
              <Text style={[s.pillText, category === cat && s.pillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {tab === 'brands' ? (
        brandsLoading
          ? <View style={s.centered}><ActivityIndicator color={C.gold} /></View>
          : filteredBrands.length === 0
            ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>◈</Text>
                <Text style={s.emptyText}>No brands match{'\n'}"{search || category}"</Text>
              </View>
            )
            : (
              <FlatList
                data={filteredBrands}
                keyExtractor={b => b.id}
                renderItem={({ item }) => <BrandCard brand={item} onPress={onNavigateToBrand} />}
                contentContainerStyle={s.brandList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              />
            )
      ) : (
        postsLoading
          ? <View style={s.centered}><ActivityIndicator color={C.gold} /></View>
          : filteredPosts.length === 0
            ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>⊞</Text>
                <Text style={s.emptyText}>No trending posts yet</Text>
              </View>
            )
            : (
              <FlatList
                data={filteredPosts}
                keyExtractor={p => p.id}
                numColumns={GRID_COLS}
                renderItem={({ item }) => <GridTile post={item} onPress={() => {}} />}
                contentContainerStyle={s.grid}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={{ gap: GRID_GAP }}
                ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
                ListHeaderComponent={
                  <View style={s.gridHeader}>
                    <Text style={s.gridHeaderText}>🔥 TRENDING THIS WEEK</Text>
                  </View>
                }
              />
            )
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  titleBar:    { paddingHorizontal: 20, justifyContent: 'flex-end', paddingBottom: 6 },
  titleLabel:  { fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: '700' },
  titleText:   { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  searchRow:   { paddingHorizontal: 14, paddingVertical: 10 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 44 },
  searchIcon:  { fontSize: 17, color: C.sub, marginRight: 8 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },

  tabRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, marginHorizontal: 14 },
  tabBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabBtnActive:{},
  tabBtnText:  { fontSize: 13, fontWeight: '600', color: C.muted },
  tabBtnTextActive: { color: C.gold },
  tabUnderline:{ position: 'absolute', bottom: -1, left: '20%', right: '20%', height: 2, backgroundColor: C.gold, borderRadius: 1 },

  pillsScroll: { flexGrow: 0, marginTop: 10 },
  pillsContent:{ paddingHorizontal: 14, gap: 8, paddingBottom: 10 },
  pill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  pillActive:  { backgroundColor: C.primaryDk, borderColor: C.primary },
  pillText:    { fontSize: 12, color: C.sub, fontWeight: '600' },
  pillTextActive: { color: C.text },

  // Brand card
  brandList:   { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  brandCard:   { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  brandCardCover: { height: 80, overflow: 'hidden', position: 'relative' },
  livePill:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: C.like, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  liveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText:    { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  brandCardBody:  { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  brandLogoWrap:  { position: 'relative' },
  brandLogo:      { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: C.border },
  verifiedDot:    { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.bg },
  brandCardInfo:  { flex: 1 },
  brandCardName:  { fontSize: 15, fontWeight: '700', color: C.text },
  brandCardCat:   { fontSize: 11, color: C.sub, marginTop: 1 },
  brandCardSubs:  { fontSize: 11, color: C.muted, marginTop: 2 },
  subBtn:         { borderWidth: 1.5, borderColor: C.primaryLt, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  subBtnActive:   { backgroundColor: C.primaryDk, borderColor: C.primaryDk },
  subBtnText:     { fontSize: 11, fontWeight: '700', color: C.primaryLt },
  subBtnTextActive:{ color: C.text },

  // Post grid
  grid:        { paddingBottom: 30 },
  gridHeader:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  gridHeaderText: { fontSize: 11, color: C.gold, fontWeight: '700', letterSpacing: 1.5 },
  tile:        { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: C.surface, overflow: 'hidden', position: 'relative' },
  tileImage:   { width: '100%', height: '100%', resizeMode: 'cover' },
  tilePlayBadge:  { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: 4 },
  tileMultiBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: 4 },
  tileLikes:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 3 },
  tileLikesText:{ color: '#fff', fontSize: 9, fontWeight: '700' },

  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon:   { fontSize: 40, color: C.muted },
  emptyText:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
});
