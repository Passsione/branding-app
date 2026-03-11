// ============================================================
// app/screens/ProfileScreen.tsx
//
// Works for both regular users AND brand accounts.
//
// Regular user sees:
//   • Their avatar, name, handle, plan badge, follower stats
//   • Edit Profile (name, username, bio, website, avatar, email, password)
//   • Upgrade (👑) button
//   • Posts grid
//   • Settings (notifications, privacy, etc. + sign out)
//
// Brand account (ownedBrand != null) additionally sees:
//   • Brand name + handle shown under avatar
//   • Brand-centric stats (subscribers, posts, revenue)
//   • 🏷 Brand Management button → edit logo, cover, colours,
//     tagline, bio, category, website, isLive toggle, revenue
//   • No "Add to Brand" or "Upgrade Plan" buttons
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Image, Modal,
  Platform, Dimensions, Animated, ActivityIndicator,
  SafeAreaView, StatusBar, Alert, KeyboardAvoidingView,
  TouchableWithoutFeedback, Switch,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import {
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth }         from '../../hooks/index';
import { useUserPosts }    from '../../hooks/index';
import { useSubscription } from '../../hooks/index';
import { auth, db }        from '../../firebase/config';
import { Post }            from '../../types';
import { Brand }              from '../../services/brandService';
import BrandPostComposer      from './BrandPostComposer';
import { PALETTE }          from '../../types/index';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:          '#0d0806',
  surface:     '#120a07',
  surfaceHigh: '#1c100a',
  border:      '#2e1a0e',
  border2:     '#3d251a',
  text:        '#f5ede6',
  textSub:     '#c4a99a',
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

const PLAN_COLOURS = {
  free:    { bg: '#1e2226', color: '#7a8390', label: 'Free'    },
  basic:   { bg: '#1d3557', color: '#3d9eff', label: 'Basic'   },
  pro:     { bg: '#2d1b69', color: '#9b6dff', label: 'Pro'     },
  creator: { bg: '#1a2f27', color: '#00e5b0', label: 'Creator' },
};

const STATUS_COLOURS = {
  active:    { bg: '#2f251acb', color: C.primary, dot: C.primary },
  suspended: { bg: '#2f1a1a',   color: C.like,    dot: C.like    },
  pending:   { bg: '#2f2510',   color: C.gold,    dot: C.gold    },
};

const GRID_COLS = 3;
const TILE      = (SW - 4) / GRID_COLS;

// ─────────────────────────────────────────────────────────────
// Hook: live-subscribe to the brand owned by this uid
// ─────────────────────────────────────────────────────────────
const useOwnedBrand = (uid: string | undefined) => {
  const [brand,   setBrand]   = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'brands', uid),
      snap => { setBrand(snap.exists() ? (snap.data() as Brand) : null); setLoading(false); },
      ()   => { setBrand(null); setLoading(false); },
    );
    return unsub;
  }, [uid]);

  return { brand, loading };
};

// ─────────────────────────────────────────────────────────────
// Post tile
// ─────────────────────────────────────────────────────────────
const PostTile: React.FC<{ post: Post }> = ({ post }) => {
  const img = post.media?.[0]?.url;
  return (
    <TouchableOpacity activeOpacity={0.8} style={pt.tile}>
      {img
        ? <Image source={{ uri: img }} style={pt.img} />
        : <View style={[pt.img, { backgroundColor: C.surface }]} />
      }
      {post.type === 'carousel' && <View style={pt.badge}><Text style={pt.badgeText}>⧉</Text></View>}
      {post.type === 'video'    && <View style={pt.badge}><Text style={pt.badgeText}>▶</Text></View>}
      {post.type === 'reel'     && <View style={pt.badge}><Text style={pt.badgeText}>🎵</Text></View>}
    </TouchableOpacity>
  );
};
const pt = StyleSheet.create({
  tile:      { width: TILE, height: TILE, backgroundColor: C.surface },
  img:       { width: '100%', height: '100%', resizeMode: 'cover' },
  badge:     { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 5, padding: 3 },
  badgeText: { color: '#fff', fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────
// Shared field helpers
// ─────────────────────────────────────────────────────────────
const FL: React.FC<{ children: string; gold?: boolean }> = ({ children, gold }) => (
  <Text style={[sh.fieldLabel, gold && { color: C.gold }]}>{children}</Text>
);
const sh = StyleSheet.create({
  fieldLabel: { fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border2, borderRadius: 10, color: C.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────
// Edit Profile Sheet
// Fields: displayName, username, bio, website, avatarUrl,
//         email change, optional password change
// ─────────────────────────────────────────────────────────────
interface EditForm {
  displayName: string;
  username:    string;
  bio:         string;
  website:     string;
  avatarUrl:   string;
  email:       string;
}
interface EditSheetProps {
  initial: EditForm;
  onSave:  (f: EditForm, pwChange?: { current: string; next: string }) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
}

const EditSheet: React.FC<EditSheetProps> = ({ initial, onSave, onClose, saving }) => {
  const [form,        setForm]        = useState<EditForm>({ ...initial });
  const [showPw,      setShowPw]      = useState(false);
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showCurr,    setShowCurr]    = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  const set = (k: keyof EditForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (showPw) {
      if (!currentPw) { Alert.alert('Required', 'Enter your current password to confirm changes.'); return; }
      if (newPw && newPw.length < 6) { Alert.alert('Weak Password', 'New password must be at least 6 characters.'); return; }
      if (newPw && newPw !== confirmPw) { Alert.alert('Mismatch', "New passwords don't match."); return; }
      onSave(form, { current: currentPw, next: newPw });
    } else {
      onSave(form);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={es.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={es.kav}>
        <View style={es.sheet}>
          <View style={es.handle} />
          <View style={es.header}>
            <View>
              <Text style={es.headerLabel}>YOUR PROFILE</Text>
              <Text style={es.headerTitle}>Edit Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={es.closeBtn}>
              <Text style={es.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Avatar */}
            <View style={es.avatarRow}>
              {form.avatarUrl
                ? <Image source={{ uri: form.avatarUrl }} style={es.avatar} />
                : <View style={[es.avatar, { backgroundColor: C.primaryDk, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                  </View>
              }
              <View style={{ flex: 1 }}>
                <FL>Avatar URL</FL>
                <TextInput value={form.avatarUrl} onChangeText={v => set('avatarUrl', v)}
                  style={sh.input} placeholderTextColor={C.muted}
                  autoCapitalize="none" keyboardType="url" placeholder="https://…" />
              </View>
            </View>

            {/* Profile fields */}
            {([
              ['Display Name', 'displayName', 'Your Name',       'default',   'default'] as const,
              ['Username',     'username',    '@handle',          'none',      'default'] as const,
              ['Bio',          'bio',         'Tell your story…', 'sentences', 'default'] as const,
              ['Website',      'website',     'yoursite.com',     'none',      'url'    ] as const,
            ]).map(([label, key, placeholder, autoCapitalize, keyboardType]) => (
              <View key={key} style={es.fieldGroup}>
                <FL>{label}</FL>
                <TextInput
                  value={form[key]}
                  onChangeText={v => set(key, v)}
                  style={[sh.input, key === 'bio' && { height: 80, textAlignVertical: 'top' }]}
                  multiline={key === 'bio'}
                  placeholderTextColor={C.muted}
                  placeholder={placeholder}
                  autoCapitalize={autoCapitalize as any}
                  keyboardType={keyboardType as any}
                />
              </View>
            ))}

            {/* Email */}
            <View style={es.fieldGroup}>
              <FL>Email</FL>
              <TextInput value={form.email} onChangeText={v => set('email', v)}
                style={sh.input} placeholderTextColor={C.muted}
                autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            </View>

            {/* Change password toggle */}
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={es.pwToggle}>
              <Text style={es.pwToggleText}>
                {showPw ? '▲  Cancel Password Change' : '🔑  Change Password'}
              </Text>
            </TouchableOpacity>

            {showPw && (
              <View style={es.pwSection}>
                <View style={es.fieldGroup}>
                  <FL>Current Password</FL>
                  <View style={es.pwRow}>
                    <TextInput value={currentPw} onChangeText={setCurrentPw}
                      secureTextEntry={!showCurr}
                      placeholder="Required to save any changes"
                      placeholderTextColor={C.muted}
                      style={[sh.input, { flex: 1 }]} />
                    <TouchableOpacity onPress={() => setShowCurr(v => !v)} style={es.eyeBtn}>
                      <Text>{showCurr ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={es.fieldGroup}>
                  <FL>New Password</FL>
                  <View style={es.pwRow}>
                    <TextInput value={newPw} onChangeText={setNewPw}
                      secureTextEntry={!showNew}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={C.muted}
                      style={[sh.input, { flex: 1 }]} />
                    <TouchableOpacity onPress={() => setShowNew(v => !v)} style={es.eyeBtn}>
                      <Text>{showNew ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={es.fieldGroup}>
                  <FL>Confirm New Password</FL>
                  <TextInput value={confirmPw} onChangeText={setConfirmPw}
                    secureTextEntry placeholder="Repeat new password"
                    placeholderTextColor={C.muted} style={sh.input} />
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={[C.gold, C.goldLt]} style={es.saveBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving ? <ActivityIndicator color={C.bg} /> : <Text style={es.saveBtnText}>Save Profile</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const es = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  kav:          { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:        { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, maxHeight: SH * 0.92, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLabel:  { fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 3 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.sub, fontSize: 14 },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  avatar:       { width: 60, height: 60, borderRadius: 16, borderWidth: 2, borderColor: C.border },
  fieldGroup:   { paddingHorizontal: 16, marginBottom: 14 },
  saveBtn:      { margin: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:  { color: C.bg, fontSize: 15, fontWeight: '800' },
  pwToggle:     { marginHorizontal: 16, marginBottom: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border2, alignItems: 'center', backgroundColor: C.bg },
  pwToggleText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  pwSection:    { borderTopWidth: 1, borderTopColor: C.border2, paddingTop: 14 },
  pwRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:       { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});


interface ColourPickerProps {
  primary:           string;
  secondary:         string;
  onChangePrimary:   (c: string) => void;
  onChangeSecondary: (c: string) => void;
}

const ColourPicker: React.FC<ColourPickerProps> = ({
  primary, secondary, onChangePrimary, onChangeSecondary,
}) => {
  // which slot is being edited: 'primary' | 'secondary'
  const [active, setActive] = useState<'primary' | 'secondary'>('primary');

  const handleSwatch = (colour: string) => {
    if (active === 'primary') onChangePrimary(colour);
    else onChangeSecondary(colour);
  };

  return (
    <View style={cp.wrap}>
      <FL>Brand Colours</FL>

      {/* Slot selectors */}
      <View style={cp.slots}>
        <TouchableOpacity
          onPress={() => setActive('primary')}
          style={[cp.slot, active === 'primary' && cp.slotActive]}
          activeOpacity={0.8}
        >
          <View style={[cp.slotSwatch, { backgroundColor: primary }]} />
          <View>
            <Text style={cp.slotLabel}>PRIMARY</Text>
            <Text style={cp.slotHex}>{primary}</Text>
          </View>
          {active === 'primary' && <Text style={cp.slotCheck}>✓</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActive('secondary')}
          style={[cp.slot, active === 'secondary' && cp.slotActive]}
          activeOpacity={0.8}
        >
          <View style={[cp.slotSwatch, { backgroundColor: secondary }]} />
          <View>
            <Text style={cp.slotLabel}>SECONDARY</Text>
            <Text style={cp.slotHex}>{secondary}</Text>
          </View>
          {active === 'secondary' && <Text style={cp.slotCheck}>✓</Text>}
        </TouchableOpacity>
      </View>

      {/* Palette grid */}
      <View style={cp.grid}>
        {PALETTE.map(colour => {
          const isPrimSel = colour === primary;
          const isSecSel  = colour === secondary;
          return (
            <TouchableOpacity
              key={colour}
              onPress={() => handleSwatch(colour)}
              activeOpacity={0.75}
              style={[
                cp.swatch,
                { backgroundColor: colour },
                (isPrimSel || isSecSel) && cp.swatchSelected,
              ]}
            >
              {isPrimSel && <Text style={cp.swatchMark}>1</Text>}
              {isSecSel  && <Text style={cp.swatchMark}>2</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={cp.hint}>
        Tap a slot above, then pick a colour  ·  1 = primary  2 = secondary
      </Text>
    </View>
  );
};

const SWATCH_SIZE = (SW - 32 - 16 * 2) / 9; // 9 per row, padded

const cp = StyleSheet.create({
  wrap:          { paddingHorizontal: 16, marginBottom: 14 },
  slots:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  slot:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border2, padding: 10 },
  slotActive:    { borderColor: C.primary },
  slotSwatch:    { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  slotLabel:     { fontSize: 9, color: C.sub, fontWeight: '700', letterSpacing: 1 },
  slotHex:       { fontSize: 12, color: C.text, fontWeight: '600', marginTop: 1 },
  slotCheck:     { marginLeft: 'auto' as any, fontSize: 14, color: C.primary, fontWeight: '800' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch:        { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  swatchSelected:{ borderWidth: 2.5, borderColor: '#fff' },
  swatchMark:    { fontSize: 10, color: '#fff', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  hint:          { fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 10, letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────
// Brand Management Sheet
// Brand owners can edit their own brand details, toggle live,
// and update revenue. Status is read-only (admin sets it).
// ─────────────────────────────────────────────────────────────
interface BrandEditForm {
  name:           string;
  tagline:        string;
  bio:            string;
  logoUrl:        string;
  coverUrl:       string;
  primaryColor:   string;
  secondaryColor: string;
  category:       string;
  website:        string;
  isLive:         boolean;
  revenue:        number;
}

const BrandMgmtSheet: React.FC<{ brand: Brand; onClose: () => void }> = ({ brand, onClose }) => {
  const [form, setForm] = useState<BrandEditForm>({
    name:           brand.name,
    tagline:        brand.tagline,
    bio:            brand.bio,
    logoUrl:        brand.logoUrl,
    coverUrl:       brand.coverUrl,
    primaryColor:   brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    category:       brand.category,
    website:        brand.website ?? '',
    isLive:         brand.isLive,
    revenue:        brand.revenue ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState<string | null>(null);

  const set = (k: keyof BrandEditForm, v: any) => setForm(f => ({ ...f, [k]: v }));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'brands', brand.id), {
        name:           form.name,
        tagline:        form.tagline,
        bio:            form.bio,
        logoUrl:        form.logoUrl,
        coverUrl:       form.coverUrl,
        primaryColor:   form.primaryColor,
        secondaryColor: form.secondaryColor,
        category:       form.category,
        website:        form.website || null,
        isLive:         form.isLive,
        revenue:        form.revenue,
        updatedAt:      serverTimestamp(),
      });
      // Keep user profile in sync
      await updateDoc(doc(db, 'users', brand.id), {
        displayName: form.name,
        bio:         form.bio,
        avatarUrl:   form.logoUrl,
        website:     form.website || '',
        updatedAt:   serverTimestamp(),
      });
      showToast('Brand updated ✓');
    } catch (e: any) {
      showToast(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = STATUS_COLOURS[brand.status] ?? STATUS_COLOURS.pending;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={bm.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={bm.kav}>
        <View style={bm.sheet}>
          <View style={bm.handle} />

          <View style={bm.header}>
            <View>
              <Text style={bm.headerLabel}>🏷  BRAND MANAGEMENT</Text>
              <Text style={bm.headerTitle}>{brand.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={bm.closeBtn}>
              <Text style={bm.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Status (read-only) */}
            <View style={bm.statusRow}>
              <View style={[bm.statusPill, { backgroundColor: statusMeta.bg, borderColor: statusMeta.color }]}>
                <View style={[bm.statusDot, { backgroundColor: statusMeta.dot }]} />
                <Text style={[bm.statusText, { color: statusMeta.color }]}>{brand.status.toUpperCase()}</Text>
              </View>
              <Text style={bm.statusNote}>Status is set by admin</Text>
            </View>

            {/* Colour preview */}
            <LinearGradient
              colors={[form.primaryColor || '#333', form.secondaryColor || '#111']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={bm.colorBanner}
            >
              <Text style={bm.colorBannerText}>{form.name || 'Brand Name'}</Text>
              <Text style={bm.colorBannerSub}>{form.primaryColor}  →  {form.secondaryColor}</Text>
            </LinearGradient>

            {/* Editable fields */}
            {([
              ['Brand Name',   'name',     'e.g. jacket.co',              'default',   'default'],
              ['Tagline',      'tagline',  'GOOD VIBES / GREAT BREWS',    'default',   'default'],
              ['Category',     'category', 'Fashion, Design, Photography…','default',  'default'],
              ['Website',      'website',  'brand.com',                    'none',      'url'    ],
              ['Logo URL',     'logoUrl',  'https://…',                    'none',      'url'    ],
              ['Cover URL',    'coverUrl', 'https://…',                    'none',      'url'    ],
            ] as const).map(([label, key, placeholder, autoCapitalize, keyboardType]) => (
              <View key={key} style={bm.fg}>
                <FL>{label}</FL>
                <TextInput
                  value={form[key as keyof BrandEditForm] as string}
                  onChangeText={v => set(key as keyof BrandEditForm, v)}
                  style={sh.input}
                  placeholderTextColor={C.muted}
                  placeholder={placeholder}
                  autoCapitalize={autoCapitalize as any}
                  keyboardType={keyboardType as any}
                />
              </View>
            ))}

            {/* Bio */}
            <View style={bm.fg}>
              <FL>Bio</FL>
              <TextInput value={form.bio} onChangeText={v => set('bio', v)}
                style={[sh.input, { height: 80, textAlignVertical: 'top' }]}
                placeholderTextColor={C.muted} multiline />
            </View>

            {/* Colours */}
            <ColourPicker
              primary={form.primaryColor}
              secondary={form.secondaryColor}
              onChangePrimary={v => set('primaryColor', v)}
              onChangeSecondary={v => set('secondaryColor', v)}
            />

            {/* Revenue */}
            <View style={bm.fg}>
              <FL gold>Monthly Revenue (ZAR)</FL>
              <TextInput
                value={String(form.revenue)}
                onChangeText={v => set('revenue', parseFloat(v) || 0)}
                style={sh.input} placeholderTextColor={C.muted}
                keyboardType="numeric" placeholder="0" />
            </View>

            {/* Read-only stats */}
            <View style={bm.roStats}>
              {([
                ['Subscribers', brand.subscribersCount ?? 0],
                ['Posts',       brand.postsCount       ?? 0],
                ['Live Viewers',brand.liveViewers      ?? 0],
              ] as [string, number][]).map(([l, v]) => (
                <View key={l} style={bm.roStat}>
                  <Text style={bm.roStatValue}>{v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</Text>
                  <Text style={bm.roStatLabel}>{l}</Text>
                </View>
              ))}
            </View>

          </ScrollView>

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={[C.primary, C.primaryDk]} style={bm.saveBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving ? <ActivityIndicator color={C.text} /> : <Text style={bm.saveBtnText}>Save Brand</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {toast && (
            <View style={bm.toast}><Text style={bm.toastText}>{toast}</Text></View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const bm = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  kav:            { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:          { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, maxHeight: SH * 0.92, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLabel:    { fontSize: 10, color: C.primary, letterSpacing: 2, marginBottom: 3 },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn:       { width: 32, height: 32, borderRadius: 8, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:   { color: C.sub, fontSize: 14 },
  statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusDot:      { width: 7, height: 7, borderRadius: 4 },
  statusText:     { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusNote:     { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  colorBanner:    { margin: 16, borderRadius: 14, padding: 20, height: 76, justifyContent: 'flex-end' },
  colorBannerText:{ color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.9 },
  colorBannerSub: { color: '#fff', fontSize: 10, opacity: 0.5, marginTop: 2 },
  liveRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 14 },
  liveLabel:      { fontSize: 14, fontWeight: '700', color: C.sub },
  liveSub:        { fontSize: 11, color: C.muted, marginTop: 2 },
  fg:             { paddingHorizontal: 16, marginBottom: 14 },
  twoCol:         { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 14 },
  roStats:        { flexDirection: 'row', marginHorizontal: 16, marginTop: 4, marginBottom: 16, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  roStat:         { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: C.border },
  roStatValue:    { fontSize: 16, fontWeight: '800', color: C.text },
  roStatLabel:    { fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  saveBtn:        { margin: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:    { color: C.text, fontSize: 15, fontWeight: '800' },
  toast:          { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.primary + '60' },
  toastText:      { color: C.primary, fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────
// Settings Sheet
// ─────────────────────────────────────────────────────────────
const SettingsSheet: React.FC<{
  onClose:       () => void;
  onSignOut:     () => void;
  onGoToPremium: () => void;
  isBrand:       boolean;
}> = ({ onClose, onSignOut, onGoToPremium, isBrand }) => {
  const items = [
    ...(!isBrand ? [{ icon: '👑', label: 'Upgrade Plan',    sub: 'Unlock more features',      action: onGoToPremium, color: C.gold }] : []),
    { icon: '🔔', label: 'Notifications',   sub: 'Manage your alerts',        action: () => {}, color: C.text },
    { icon: '🔒', label: 'Privacy',         sub: 'Account visibility',        action: () => {}, color: C.text },
    { icon: '🎨', label: 'Appearance',      sub: 'Theme & display options',   action: () => {}, color: C.text },
    { icon: '💬', label: 'Support',         sub: 'Help centre & feedback',    action: () => {}, color: C.text },
    { icon: '📋', label: 'Terms & Privacy', sub: 'Legal docs',                action: () => {}, color: C.sub  },
  ];
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}><View style={ss.backdrop} /></TouchableWithoutFeedback>
      <View style={ss.wrap}>
        <View style={ss.sheet}>
          <View style={ss.handle} />
          <Text style={ss.title}>Settings</Text>
          {items.map(({ icon, label, sub, action, color }) => (
            <TouchableOpacity key={label} onPress={action} style={ss.item}>
              <View style={ss.itemIcon}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[ss.itemLabel, { color }]}>{label}</Text>
                <Text style={ss.itemSub}>{sub}</Text>
              </View>
              <Text style={ss.chevron}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={ss.divider} />
          <TouchableOpacity onPress={onSignOut} style={ss.signOutBtn}>
            <Text style={ss.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ss = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  wrap:       { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:      { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  title:      { fontSize: 17, fontWeight: '800', color: C.text, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16 },
  item:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  itemIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  itemLabel:  { fontSize: 15, fontWeight: '600', color: C.text },
  itemSub:    { fontSize: 12, color: C.sub, marginTop: 1 },
  chevron:    { fontSize: 20, color: C.muted },
  divider:    { height: 1, backgroundColor: C.border, marginHorizontal: 20, marginVertical: 8 },
  signOutBtn: { marginHorizontal: 20, marginTop: 6, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.like + '80' },
  signOutText:{ color: C.like, fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────
// Main ProfileScreen
// ─────────────────────────────────────────────────────────────
interface ProfileScreenProps {
  onGoToPremium: () => void;
}

export default function ProfileScreen({ onGoToPremium }: ProfileScreenProps) {
  const { userProfile, loading: authLoading, firebaseUser } = useAuth();
  const { posts, loading: postsLoading, refresh: refreshPosts } = useUserPosts(userProfile?.uid ?? '');
  const { tier }                                            = useSubscription();
  const { brand: ownedBrand }                               = useOwnedBrand(userProfile?.uid);

  const [showEdit,      setShowEdit]      = useState(false);
  const [showBrandMgmt, setShowBrandMgmt] = useState(false);
  const [showComposer,  setShowComposer]  = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState<string | null>(null);

  const scrollY       = useRef(new Animated.Value(0)).current;
  const avatarScale   = scrollY.interpolate({ inputRange: [-60, 0, 80], outputRange: [1.3, 1, 0.7], extrapolate: 'clamp' });
  const headerOpacity = scrollY.interpolate({ inputRange: [60, 100], outputRange: [0, 1], extrapolate: 'clamp' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Save profile (+ optional email / password changes) ──────
  const handleSaveProfile = useCallback(async (
    form: EditForm,
    pwChange?: { current: string; next: string },
  ) => {
    if (!userProfile || !firebaseUser) return;
    setSaving(true);
    try {
      if (pwChange?.current) {
        const cred = EmailAuthProvider.credential(firebaseUser.email!, pwChange.current);
        await reauthenticateWithCredential(firebaseUser, cred);
      }
      if (form.email && form.email !== firebaseUser.email) {
        await updateEmail(firebaseUser, form.email);
      }
      if (pwChange?.next) {
        await updatePassword(firebaseUser, pwChange.next);
      }
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName: form.displayName,
        username:    form.username.toLowerCase(),
        bio:         form.bio,
        website:     form.website,
        avatarUrl:   form.avatarUrl,
        email:       form.email,
        updatedAt:   serverTimestamp(),
      });
      setShowEdit(false);
      showToast('Profile updated ✓');
    } catch (e: any) {
      const msg =
        e.code === 'auth/wrong-password'         ? 'Current password is incorrect.'            :
        e.code === 'auth/email-already-in-use'   ? 'That email is already in use.'             :
        e.code === 'auth/requires-recent-login'  ? 'Please sign out and back in, then retry.'  :
        e.message ?? 'Save failed';
      showToast(msg);
    } finally {
      setSaving(false);
    }
  }, [userProfile, firebaseUser]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }, []);

  if (authLoading) {
    return <SafeAreaView style={s.safe}><View style={s.centered}><ActivityIndicator color={C.gold} /></View></SafeAreaView>;
  }

  const u       = userProfile;
  const isBrand = !!ownedBrand;
  const planMeta = PLAN_COLOURS[tier ?? 'free'];

  // Stats differ between brand and user views
  const statItems = isBrand
    ? [
        { label: 'SUBSCRIBERS', value: ownedBrand!.subscribersCount ?? 0 },
        { label: 'POSTS',       value: ownedBrand!.postsCount       ?? 0 },
        { label: 'REVENUE',     value: ownedBrand!.revenue > 0 ? `$${ownedBrand!.revenue}` : '—' },
      ]
    : [
        { label: 'POSTS',     value: u?.postsCount     ?? posts.length },
        { label: 'FOLLOWING', value: u?.followingCount  ?? 0 },
        { label: 'FOLLOWERS', value: u?.followersCount  ?? 0 },
      ];

  const headerColors: [string, string] = isBrand
    ? [(ownedBrand!.primaryColor ?? C.primaryDk) + '80', C.bg]
    : [C.primaryDk + '60', C.bg];

  const avatarUri = isBrand ? ownedBrand!.logoUrl : u?.avatarUrl;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Sticky name on scroll */}
      <Animated.View style={[s.stickyHeader, { opacity: headerOpacity }]} pointerEvents="none">
        <Text style={s.stickyName}>
          {isBrand ? ownedBrand!.name : (u?.displayName ?? u?.username ?? 'Profile')}
        </Text>
      </Animated.View>

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.topLabel}>{isBrand ? '🏷  MY BRAND' : '✦ MY PROFILE'}</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={s.settingsBtn}>
          <Text style={s.settingsIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Header card ── */}
        <View style={s.headerCard}>
          <LinearGradient colors={headerColors} style={s.headerBg} />

          <View style={s.avatarSection}>
            <Animated.View style={[s.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }}
                    style={[s.avatar, isBrand && { borderRadius: 20, borderColor: ownedBrand!.primaryColor }]} />
                : <View style={[s.avatar, { backgroundColor: C.primaryDk, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 36 }}>{isBrand ? '🏷' : '👤'}</Text>
                  </View>
              }
              {isBrand && ownedBrand!.isLive && (
                <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
              )}
              {u?.isVerified && (
                <View style={s.verifiedBadge}><Text style={s.verifiedText}>✓</Text></View>
              )}
              
            </Animated.View>

            {/* Status pill (brands) or plan badge (users) */}
            {isBrand ? (
              <View style={[s.planBadge, {
                backgroundColor: STATUS_COLOURS[ownedBrand!.status]?.bg ?? C.surfaceHigh,
                borderWidth: 1, borderColor: STATUS_COLOURS[ownedBrand!.status]?.color ?? C.sub,
              }]}>
                <Text style={[s.planText, { color: STATUS_COLOURS[ownedBrand!.status]?.color ?? C.sub }]}>
                  {ownedBrand!.status.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={[s.planBadge, { backgroundColor: planMeta.bg }]}>
                <Text style={[s.planText, { color: planMeta.color }]}>
                  {tier === 'creator' ? '✦ ' : ''}{planMeta.label.toUpperCase()}
                </Text>
              </View>
            )}

          </View>

          {/* Name */}
          <Text style={s.displayName}>
            {isBrand ? ownedBrand!.name : (u?.displayName ?? 'Your Name')}
          </Text>

          {/* Handle row: brands show brand handle + @username, users show @username */}
          {isBrand ? (
            <View style={s.brandHandleRow}>
              <Text style={[s.handle, { color: C.primary }]}>{ownedBrand!.handle}</Text>
              <Text style={s.handleDot}>·</Text>
              <Text style={[s.handle, { color: C.sub }]}>@{u?.username}</Text>
            </View>
          ) : (
            <Text style={s.handle}>@{u?.username ?? 'username'}</Text>
          )}

          {/* Bio */}
          {!!(isBrand ? ownedBrand?.bio : u?.bio) && (
            <Text style={s.bio}>{isBrand ? ownedBrand!.bio : u!.bio}</Text>
          )}

          {/* Website */}
          {!!(isBrand ? ownedBrand?.website : u?.website) && (
            <View style={s.websiteRow}>
              <Text style={s.websiteIcon}>🔗</Text>
              <Text style={s.websiteText}>{isBrand ? ownedBrand!.website : u!.website}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={s.statsRow}>
            {statItems.map(({ label, value }, i) => (
              <React.Fragment key={label}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>
                    {typeof value === 'number' && value >= 1000
                      ? (value / 1000).toFixed(1) + 'k'
                      : value}
                  </Text>
                  <Text style={s.statLabel}>{label}</Text>
                </View>
                {i < statItems.length - 1 && <View style={s.statDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Action buttons */}
          <View style={s.profileActions}>
            <TouchableOpacity onPress={() => setShowEdit(true)} style={s.editBtn}>
              <Text style={s.editBtnText}>✎  Edit Profile</Text>
            </TouchableOpacity>

            {/* Brand accounts get a brand management button */}
            {isBrand && (
              <TouchableOpacity onPress={() => setShowBrandMgmt(true)} style={s.iconBtn}>
                <LinearGradient colors={[C.primary, C.primaryDk]} style={s.iconBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={s.iconBtnText}>🏷</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Regular users get an upgrade button */}
            {!isBrand && (
              <TouchableOpacity onPress={onGoToPremium} style={s.iconBtn}>
                <LinearGradient colors={[C.gold, C.goldLt]} style={s.iconBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={s.iconBtnText}>👑</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Posts grid ── */}
        <View style={s.gridSection}>
          <View style={s.gridSectionHeader}>
            <Text style={s.gridSectionLabel}>✦ POSTS</Text>
            <View style={s.liveButton}><Text style={s.liveButtonText}>LIVE</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!postsLoading && <Text style={s.gridSectionCount}>{posts.length} posts</Text>}
              {isBrand && (
                <TouchableOpacity onPress={() => setShowComposer(true)} style={s.newPostBtn}>
                  <LinearGradient
                    colors={[ownedBrand!.primaryColor || C.primary, ownedBrand!.secondaryColor || C.primaryDk]}
                    style={s.newPostBtnGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={s.newPostBtnText}>+ New Post</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {postsLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={C.gold} /></View>
          ) : posts.length === 0 ? (
            <View style={s.emptyPosts}>
              <Text style={s.emptyIcon}>⊞</Text>
              <Text style={s.emptyText}>No posts yet</Text>
              <Text style={s.emptySubText}>Your posts will appear here</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {posts.map((post, i) => (
                <React.Fragment key={post.id}>
                  <PostTile post={post} />
                  {(i + 1) % GRID_COLS === 0 && <View style={{ width: '100%', height: 2 }} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </Animated.ScrollView>

      {/* Edit Profile sheet */}
      {showEdit && (
        <EditSheet
          initial={{
            displayName: isBrand ? ownedBrand!.name       : (u?.displayName ?? ''),
            username:    u?.username ?? '',
            bio:         isBrand ? ownedBrand!.bio         : (u?.bio         ?? ''),
            website:     isBrand ? (ownedBrand!.website ?? '') : (u?.website ?? ''),
            avatarUrl:   isBrand ? ownedBrand!.logoUrl     : (u?.avatarUrl   ?? ''),
            email:       firebaseUser?.email ?? '',
          }}
          onSave={handleSaveProfile}
          onClose={() => setShowEdit(false)}
          saving={saving}
        />
      )}

      {/* Brand Management sheet — brand accounts only */}
      {showBrandMgmt && ownedBrand && (
        <BrandMgmtSheet brand={ownedBrand} onClose={() => setShowBrandMgmt(false)} />
      )}

      {/* Post Composer — brand accounts only */}
      {showComposer && ownedBrand && (
        <BrandPostComposer
          brand={ownedBrand}
          onClose={() => setShowComposer(false)}
          onPosted={() => { setShowComposer(false); refreshPosts(); }}
        />
      )}

      {/* Settings sheet */}
      {showSettings && (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          onSignOut={() => { setShowSettings(false); setTimeout(handleSignOut, 400); }}
          onGoToPremium={() => { setShowSettings(false); setTimeout(onGoToPremium, 300); }}
          isBrand={isBrand}
        />
      )}

      {/* Toast */}
      {toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg, top: 31 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  stickyHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 32, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  stickyName:   { color: C.text, fontSize: 16, fontWeight: '700' },

  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  topLabel:    { fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: '700' },
  settingsBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  settingsIcon:{ fontSize: 16, color: C.sub },

  headerCard:    { marginHorizontal: 14, marginBottom: 4, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, paddingBottom: 16 },
  headerBg:      { ...StyleSheet.absoluteFillObject },
  avatarSection: { alignItems: 'center', paddingTop: 24, gap: 8 },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 88, height: 88, borderRadius: 24, borderWidth: 3, borderColor: C.primaryDk },
  verifiedBadge: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface },
  verifiedText:  { color: C.bg, fontSize: 10, fontWeight: '900' },
  liveButton:     { top: 0, left: 6, backgroundColor: C.like, borderRadius:12, height: 32,  width: 42,  paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, borderColor: C.surface },
  liveButtonText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, left: "15%", top: "35%" },
  liveBadge:     { position: 'absolute', top: -6, left: -6, backgroundColor: C.like, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, borderColor: C.surface },
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  planBadge:     { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  planText:      { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  displayName:    { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  brandHandleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2, marginBottom: 6 },
  handleDot:      { color: C.muted, fontSize: 13 },
  handle:         { fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 2, marginBottom: 6 },
  bio:            { fontSize: 13, color: C.textSub, textAlign: 'center', paddingHorizontal: 28, lineHeight: 20, marginBottom: 6 },
  websiteRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 10 },
  websiteIcon:    { fontSize: 12 },
  websiteText:    { fontSize: 12, color: C.gold },

  statsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginVertical: 14, backgroundColor: C.bg + 'aa', borderRadius: 14, paddingVertical: 14 },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel:  { fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  statDivider:{ width: 1, height: 32, backgroundColor: C.border },

  profileActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  editBtn:        { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.primaryLt, backgroundColor: C.primaryDk + '40' },
  editBtnText:    { color: C.primaryLt, fontSize: 13, fontWeight: '700' },
  iconBtn:        { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  iconBtnGrad:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:    { fontSize: 18 },

  gridSection:       { marginTop: 6 },
  gridSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  gridSectionLabel:  { fontSize: 11, color: C.gold, fontWeight: '700', letterSpacing: 1.5 },
  gridSectionCount:  { fontSize: 11, color: C.muted },
  grid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  newPostBtn:        { borderRadius: 8, overflow: 'hidden' },
  newPostBtnGrad:    { paddingHorizontal: 12, paddingVertical: 6 },
  newPostBtnText:    { color: '#fff', fontSize: 11, fontWeight: '800' },

  emptyPosts:   { paddingVertical: 50, alignItems: 'center', gap: 8 },
  emptyIcon:    { fontSize: 36, color: C.muted },
  emptyText:    { fontSize: 15, color: C.sub, fontWeight: '700' },
  emptySubText: { fontSize: 12, color: C.muted },

  toast:     { position: 'absolute', bottom: 36, alignSelf: 'center', backgroundColor: C.surfaceHigh, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.gold + '60' },
  toastText: { color: C.gold, fontSize: 13, fontWeight: '700' },
});
