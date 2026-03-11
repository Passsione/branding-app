// ============================================================
// app/screens/AdminDashboard.tsx
// Firebase-wired admin dashboard — full brand CRUD
// Only accessible to admin UID. Brands are read by all users
// through useBrands() and shown in the feed carousel.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TouchableWithoutFeedback, TextInput,
  Image, Modal, Platform, StatusBar, Dimensions,
  SafeAreaView, KeyboardAvoidingView, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAdminBrands, useAdminBrandActions, useIsAdmin } from '../../hooks/brandHooks';
import { Brand } from '../../services/brandService';
import { auth } from '../../firebase/config';
import { PALETTE }          from '../../types/index';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:          '#0d0806',
  surface:     '#120a07',
  surfaceHigh: '#1c100a',
  border:      '#2e1a0e',
  border2:     '#3d251a', // Slightly lighter border for depth
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

type Plan   = 'free' | 'basic' | 'pro' | 'creator';
type Status = 'active' | 'suspended' | 'pending';

const PLAN_META: Record<Plan, { label: string; bg: string; color: string }> = {
  free:    { label: 'Free',    bg: '#1e2226', color: C.sub    },
  basic:   { label: 'Basic',   bg: '#1d3557', color: C.primaryLt   },
  pro:     { label: 'Pro',     bg: '#2d1b69', color: C.primaryDk },
  creator: { label: 'Creator', bg: '#2f251acb', color: C.primary },
};

const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  active:    { label: 'Active',    bg: '#2f251acb', color: C.primary, dot: C.primary },
  suspended: { label: 'Suspended', bg: '#2f1a1a', color: C.like,    dot: C.like    },
  pending:   { label: 'Pending',   bg: '#2f2510', color: C.gold,  dot: C.gold  },
};

const fmtNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);


const SWATCH_SIZE = (SW - 32 - 16 * 2) / 9;

interface ColourPickerProps {
  primary:           string;
  secondary:         string;
  onChangePrimary:   (c: string) => void;
  onChangeSecondary: (c: string) => void;
}

const ColourPicker: React.FC<ColourPickerProps> = ({
  primary, secondary, onChangePrimary, onChangeSecondary,
}) => {
  const [active, setActive] = useState<'primary' | 'secondary'>('primary');

  const handleSwatch = (colour: string) => {
    if (active === 'primary') onChangePrimary(colour);
    else onChangeSecondary(colour);
  };

  return (
    <View style={cp.wrap}>
      <Text style={cp.label}>BRAND COLOURS</Text>

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

      <Text style={cp.hint}>Tap a slot · then pick a colour  ·  1 = primary  2 = secondary</Text>
    </View>
  );
};

const cp = StyleSheet.create({
  wrap:          { paddingHorizontal: 16, marginBottom: 14 },
  label:         { fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
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

const BLANK_BRAND: Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'subscribersCount' | 'postsCount' | 'liveViewers'> = {
  name:           '',
  handle:         '@',
  tagline:        '',
  bio:            '',
  logoUrl:        '',
  coverUrl:       '',
  primaryColor:   '#9B5035',
  secondaryColor: '#0d0806',
  category:       'Fashion',
  website:        null,
  fonts:          [],
  isVerified:     false,
  isLive:         false,   // brands set this themselves
  status:         'pending',
  plan:           'free',
  flagged:        false,
  revenue:        0,       // brands set this themselves
  ownerUid:       null,    // auto-set from created Firebase user
};

// ── Helpers ───────────────────────────────────────────────────
const FieldLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={s.fieldLabel}>{children}</Text>
);

const Badge: React.FC<{ type: 'plan' | 'status'; value: string }> = ({ type, value }) => {
  const meta = type === 'plan' ? PLAN_META[value as Plan] : STATUS_META[value as Status];
  if (!meta) return null;
  return (
    <View style={[s.badge, { backgroundColor: meta.bg }]}>
      <Text style={[s.badgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
    </View>
  );
};

// ── Create / Edit Sheet ───────────────────────────────────────
type EditableBrand = Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'subscribersCount' | 'postsCount' | 'liveViewers'>;

interface EditSheetProps {
  brand: Brand | null;  // null = create mode
  onSave: (data: EditableBrand, credentials?: { email: string; password: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}
const EditSheet: React.FC<EditSheetProps> = ({ brand, onSave, onClose, saving }) => {
  const isCreate = !brand;
  const [form, setForm] = useState<EditableBrand>(
    brand
      ? {
          name: brand.name, handle: brand.handle, tagline: brand.tagline,
          bio: brand.bio, logoUrl: brand.logoUrl, coverUrl: brand.coverUrl,
          primaryColor: brand.primaryColor, secondaryColor: brand.secondaryColor,
          category: brand.category, website: brand.website, fonts: brand.fonts,
          isVerified: brand.isVerified, isLive: brand.isLive, status: brand.status,
          plan: brand.plan, flagged: brand.flagged, revenue: brand.revenue,
          ownerUid: brand.ownerUid,
        }
      : { ...BLANK_BRAND },
  );

  // Credentials for new brand account (create mode only)
  const [brandEmail,    setBrandEmail]    = useState('');
  const [brandPassword, setBrandPassword] = useState('');
  const [showPassword,  setShowPassword]  = useState(false);

  const set = (k: keyof EditableBrand, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (isCreate) {
      if (!brandEmail.trim() || !brandPassword.trim()) {
        Alert.alert('Missing Credentials', 'Please enter both an email and password for the brand account.');
        return;
      }
      if (brandPassword.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters.');
        return;
      }
      onSave(form, { email: brandEmail.trim(), password: brandPassword });
    } else {
      onSave(form);
    }
  };

  const cyclePlan   = () => {
    const plans: Plan[] = ['free', 'basic', 'pro', 'creator'];
    set('plan', plans[(plans.indexOf(form.plan) + 1) % plans.length]);
  };
  const cycleStatus = () => {
    const statuses: Status[] = ['active', 'suspended', 'pending'];
    set('status', statuses[(statuses.indexOf(form.status) + 1) % statuses.length]);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.sheetBackdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.sheetWrap}
      >
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          {/* Header */}
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetLabel}>{isCreate ? 'NEW BRAND' : 'EDITING BRAND'}</Text>
              <Text style={s.sheetTitle}>{isCreate ? 'Create Brand' : form.name || brand?.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Brand Account Credentials — create mode only */}
            {isCreate && (
              <View style={[s.fieldGroup, { paddingTop: 14, marginTop: 4 }]}>
                <Text style={[s.fieldLabel, { color: C.gold, marginBottom: 10 }]}>
                  🔑  BRAND ACCOUNT LOGIN
                </Text>
                <Text style={{ color: C.sub, fontSize: 11, marginBottom: 14, lineHeight: 16 }}>
                  A Firebase account will be created with these credentials. Share them with the brand owner so they can log in.
                </Text>
                <FieldLabel>Brand Email</FieldLabel>
                <TextInput
                  value={brandEmail}
                  onChangeText={setBrandEmail}
                  style={[s.input, { marginBottom: 12 }]}
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="brand@example.com"
                />
                <FieldLabel>Password</FieldLabel>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    value={brandPassword}
                    onChangeText={setBrandPassword}
                    style={[s.input, { paddingRight: 48 }]}
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPassword}
                    placeholder="Min. 6 characters"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 12, top: 12 }}
                  >
                    <Text style={{ color: C.sub, fontSize: 13 }}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {/* Brand colour preview */}
            <LinearGradient
              colors={[form.primaryColor || '#333', form.secondaryColor || '#111']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[s.colorPreview, ]}
            >
              <Text style={s.colorPreviewText}>{form.name || 'Brand Name'}</Text>
              <Text style={s.colorPreviewSub}>{form.primaryColor} → {form.secondaryColor}</Text>
            </LinearGradient>

            {/* Name */}
            <View style={s.fieldGroup}>
              <FieldLabel>Brand Name</FieldLabel>
              <TextInput value={form.name} onChangeText={v => set('name', v)}
                style={s.input} placeholderTextColor={C.muted} placeholder="e.g. jacket.co" />
            </View>

            {/* Handle */}
            <View style={s.fieldGroup}>
              <FieldLabel>Handle</FieldLabel>
              <TextInput value={form.handle} onChangeText={v => set('handle', v)}
                style={s.input} placeholderTextColor={C.muted} autoCapitalize="none"
                placeholder="@brandname" />
            </View>

            {/* Tagline */}
            <View style={s.fieldGroup}>
              <FieldLabel>Tagline</FieldLabel>
              <TextInput value={form.tagline} onChangeText={v => set('tagline', v)}
                style={s.input} placeholderTextColor={C.muted}
                placeholder="GOOD VIBES / GREAT BREWS" />
            </View>

            {/* Bio */}
            <View style={s.fieldGroup}>
              <FieldLabel>Bio</FieldLabel>
              <TextInput value={form.bio} onChangeText={v => set('bio', v)}
                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                multiline placeholderTextColor={C.muted} />
            </View>

            {/* Category */}
            <View style={s.fieldGroup}>
              <FieldLabel>Category</FieldLabel>
              <TextInput value={form.category} onChangeText={v => set('category', v)}
                style={s.input} placeholderTextColor={C.muted}
                placeholder="Fashion, Design, Photography…" />
            </View>

            {/* Website */}
            <View style={s.fieldGroup}>
              <FieldLabel>Website</FieldLabel>
              <TextInput value={form.website ?? ''} onChangeText={v => set('website', v || null)}
                style={s.input} placeholderTextColor={C.muted}
                autoCapitalize="none" keyboardType="url" placeholder="brand.com" />
            </View>

            {/* Logo URL */}
            <View style={s.fieldGroup}>
              <FieldLabel>Logo URL</FieldLabel>
              <TextInput value={form.logoUrl} onChangeText={v => set('logoUrl', v)}
                style={s.input} placeholderTextColor={C.muted}
                autoCapitalize="none" keyboardType="url" placeholder="https://…" />
            </View>

            {/* Cover URL */}
            <View style={s.fieldGroup}>
              <FieldLabel>Cover Image URL</FieldLabel>
              <TextInput value={form.coverUrl} onChangeText={v => set('coverUrl', v)}
                style={s.input} placeholderTextColor={C.muted}
                autoCapitalize="none" keyboardType="url" placeholder="https://…" />
            </View>

            {/* Colours */}
            <ColourPicker
              primary={form.primaryColor}
              secondary={form.secondaryColor}
              onChangePrimary={v => set('primaryColor', v)}
              onChangeSecondary={v => set('secondaryColor', v)}
            />

            {/* Fonts (comma-separated) */}
            <View style={s.fieldGroup}>
              <FieldLabel>Fonts (comma separated)</FieldLabel>
              <TextInput
                value={form.fonts.join(', ')}
                onChangeText={v => set('fonts', v.split(',').map(f => f.trim()).filter(Boolean))}
                style={s.input} placeholderTextColor={C.muted}
                placeholder="LEXTON, ARIAL NOVA" />
            </View>

            {/* Revenue — edit mode only (brand manages this themselves) */}
            {!isCreate && (
              <View style={s.fieldGroup}>
                <FieldLabel>Monthly Revenue (ZAR)</FieldLabel>
                <TextInput
                  value={String(form.revenue)}
                  onChangeText={v => set('revenue', parseFloat(v) || 0)}
                  style={s.input} placeholderTextColor={C.muted}
                  keyboardType="numeric" />
              </View>
            )}

            {/* Owner UID — shown in edit mode only (auto-set on create) */}
            {/* {!isCreate && (
              <View style={s.fieldGroup}>
                <FieldLabel>Owner UID (read only)</FieldLabel>
                <View style={[s.input, { opacity: 0.5 }]}>
                  <Text style={{ color: C.sub, fontSize: 12 }}>{form.ownerUid ?? 'Not set'}</Text>
                </View>
              </View>
            )} */}


            {/* Plan & Status */}
            <View style={[s.row, { paddingHorizontal: 16, gap: 12, marginBottom: 14 }]}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Plan</FieldLabel>
                <TouchableOpacity onPress={cyclePlan} style={[s.input, s.cycleBtn]}>
                  <Badge type="plan" value={form.plan} />
                  <Text style={s.cycleTap}>tap ›</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Status</FieldLabel>
                <TouchableOpacity onPress={cycleStatus} style={[s.input, s.cycleBtn]}>
                  <Badge type="status" value={form.status} />
                  <Text style={s.cycleTap}>tap ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Toggles */}
            <View style={[s.row, { paddingHorizontal: 16, gap: 12, marginBottom: 8 }]}>
              {([
                ['isVerified', '✓ Verified', C.primary, '#2f251acb'],
                ['flagged',    '⚑ Flagged',  C.like,    '#2f1a1a'],
                // isLive is managed by the brand themselves, only show in edit mode
                // ...(!isCreate ? [['isLive', '● Live', C.gold, '#2f2510'] as const] : []),
              ] as const).map(([k, lbl, activeColor, activeBg]) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => set(k, !form[k as keyof EditableBrand])}
                  style={[
                    s.toggleBtn,
                    form[k] && { backgroundColor: activeBg, borderColor: activeColor },
                  ]}
                >
                  <Text style={[
                    s.toggleText,
                    form[k] && { color: activeColor },
                  ]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85} disabled={saving}>
            <LinearGradient
              colors={[C.primary, '#4c2e1678']}
              style={s.saveBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {saving
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.saveBtnText}>{isCreate ? '+ Create Brand' : 'Save Changes'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Brand Detail Sheet ────────────────────────────────────────
interface DetailSheetProps {
  brand: Brand;
  onEdit:         (b: Brand) => void;
  onClose:        () => void;
  onStatusChange: (id: string, s: Status) => void;
  onVerify:       (id: string) => void;
  onFlag:         (id: string) => void;
  onDelete:       (id: string) => void;
}
const DetailSheet: React.FC<DetailSheetProps> = ({
  brand, onEdit, onClose, onStatusChange, onVerify, onFlag, onDelete,
}) => (
  <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={s.sheetBackdrop} />
    </TouchableWithoutFeedback>

    <View style={[s.sheetWrap, { top: SH * 0.18 }]}>
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Colour hero */}
          <LinearGradient
            colors={[brand.primaryColor || '#333', brand.secondaryColor || '#111']}
            style={s.detailHero}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {brand.isVerified && (
              <View style={s.verifiedChip}>
                <Text style={s.verifiedChipText}>✓ VERIFIED</Text>
              </View>
            )}
            {brand.isLive && (
              <View style={[s.verifiedChip, { backgroundColor: C.like, right: undefined, left: 12 }]}>
                <Text style={s.verifiedChipText}>● LIVE</Text>
              </View>
            )}
          </LinearGradient>

          {/* Logo */}
          <View style={s.detailAvatarWrap}>
            {brand.logoUrl
              ? <Image source={{ uri: brand.logoUrl }} style={s.detailAvatar} />
              : <View style={[s.detailAvatar, { backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: C.muted, fontSize: 22 }}>🏷</Text>
                </View>
            }
          </View>

          <View style={s.detailBody}>
            <View style={s.detailNameRow}>
              <Text style={s.detailName}>{brand.name}</Text>
              {brand.flagged && <Text style={{ color: C.like, fontSize: 16 }}>⚑</Text>}
            </View>
            <Text style={s.detailHandle}>{brand.handle}  ·  {brand.category}</Text>

            <View style={[s.row, { gap: 8, marginVertical: 10 }]}>
              <Badge type="plan"   value={brand.plan}   />
              <Badge type="status" value={brand.status} />
            </View>

            <Text style={s.detailBio}>{brand.bio}</Text>
            {brand.website && <Text style={s.detailWebsite}>🔗 {brand.website}</Text>}

            {/* Stats */}
            <View style={s.statsRow}>
              {[
                ['Posts',      fmtNum(brand.postsCount),       C.text  ],
                ['Subscribers',fmtNum(brand.subscribersCount),  C.text  ],
                ['Revenue',    brand.revenue > 0 ? `$${brand.revenue}/mo` : '—', C.primary],
              ].map(([l, v, c]) => (
                <View key={l as string} style={s.statCard}>
                  <Text style={s.statLabel}>{l as string}</Text>
                  <Text style={[s.statValue, { color: c as string }]}>{v as string}</Text>
                </View>
              ))}
            </View>

            {/* <Text style={s.detailMeta}>
              ID: {brand.id}{brand.ownerUid ? `\nOwner: ${brand.ownerUid}` : '  ·  Admin-owned'}
            </Text> */}

            {/* Edit */}
            <TouchableOpacity onPress={() => onEdit(brand)} activeOpacity={0.85} style={{ marginBottom: 10 }}>
              <LinearGradient colors={[C.primary, '#b89300c1']} style={s.actionBtnPrimary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.actionBtnPrimaryText}>✎  Edit Brand</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Verify + Flag */}
            <View style={[s.row, { gap: 10, marginBottom: 10 }]}>
              <TouchableOpacity
                onPress={() => onVerify(brand.id)}
                style={[s.actionBtnOutline, { flex: 1 },
                  brand.isVerified && { borderColor: C.primary, backgroundColor: '#2f251acb' }]}
              >
                <Text style={[s.actionBtnOutlineText, brand.isVerified && { color: C.primary }]}>
                  {brand.isVerified ? '✓ Verified' : 'Verify'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onFlag(brand.id)}
                style={[s.actionBtnOutline, { flex: 1 },
                  brand.flagged && { borderColor: C.like, backgroundColor: '#2f1a1a' }]}
              >
                <Text style={[s.actionBtnOutlineText, brand.flagged && { color: C.like }]}>
                  {brand.flagged ? '⚑ Unflag' : '⚑ Flag'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Suspend / Activate */}
            <TouchableOpacity
              onPress={() => onStatusChange(brand.id, brand.status === 'active' ? 'suspended' : 'active')}
              style={[s.actionBtnOutline, { marginBottom: 10 },
                brand.status === 'active'
                  ? { borderColor: C.like,    backgroundColor: '#2f1a1a' }
                  : { borderColor: C.primary, backgroundColor: '#2f251acb' }
              ]}
            >
              <Text style={[s.actionBtnOutlineText,
                { color: brand.status === 'active' ? C.like : C.primary }]}>
                {brand.status === 'active' ? '⊘  Suspend Brand' : '⊕  Activate Brand'}
              </Text>
            </TouchableOpacity>

            {/* Delete — destructive */}
            <TouchableOpacity
              onPress={() => onDelete(brand.id)}
              style={[s.actionBtnOutline, { borderColor: C.like + '60' }]}
            >
              <Text style={[s.actionBtnOutlineText, { color: C.like }]}>🗑  Delete Brand</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// ── Main AdminDashboard ───────────────────────────────────────
export default function AdminDashboard() {
  const isAdmin = useIsAdmin();
  const { brands, loading }                      = useAdminBrands();
  const { create, update, remove, saving, deleting } = useAdminBrandActions();

  const [selected, setSelected] = useState<Brand | null>(null);
  const [editing,  setEditing]  = useState<Brand | null | 'new'>('new' as any); // null=closed, Brand=edit, 'new'=create
  const [creating, setCreating] = useState(false);
  const [search,      setSearch]      = useState('');
  const [filterPlan,  setFilterPlan]  = useState<'all' | Plan>('all');
  const [filterStatus,setFilterStatus]= useState<'all' | Status>('all');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Not admin guard ───────────────────────────────────────
  if (!isAdmin) {
    return (
      <SafeAreaView style={[s.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
          Admin Only
        </Text>
        <Text style={{ color: C.sub, fontSize: 13 }}>
          UID: {auth.currentUser?.uid ?? 'not signed in'}
        </Text>
      </SafeAreaView>
    );
  }

  // ── Handlers ─────────────────────────────────────────────
  const handleSave = useCallback(async (
    data: Parameters<typeof create>[0],
    credentials?: { email: string; password: string },
  ) => {
    try {
      if (creating || editing === null) {
        await create(data, credentials!);
        setCreating(false);
        showToast(`${data.name} created ✓`);
      } else if (editing && typeof editing !== 'string') {
        await update(editing.id, data);
        setEditing(null);
        showToast(`${data.name} updated ✓`);
      }
    } catch (e: any) {
      showToast(e.message ?? 'Save failed', false);
    }
  }, [creating, editing, create, update]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      'Delete Brand',
      'This permanently removes the brand and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await remove(id);
              setSelected(null);
              showToast('Brand deleted', false);
            } catch (e: any) {
              showToast(e.message ?? 'Delete failed', false);
            }
          },
        },
      ],
    );
  }, [remove]);

  const handleVerify = useCallback(async (id: string) => {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;
    await update(id, { isVerified: !brand.isVerified });
    showToast(`${brand.name} ${brand.isVerified ? 'unverified' : 'verified ✓'}`);
  }, [brands, update]);

  const handleFlag = useCallback(async (id: string) => {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;
    await update(id, { flagged: !brand.flagged });
    showToast(`${brand.name} ${brand.flagged ? 'unflagged' : 'flagged ⚑'}`, !brand.flagged);
  }, [brands, update]);

  const handleStatusChange = useCallback(async (id: string, status: Status) => {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;
    await update(id, { status });
    showToast(`${brand.name} → ${status}`, status === 'active');
    // keep detail sheet in sync
    if (selected?.id === id) setSelected({ ...selected, status });
  }, [brands, update, selected]);

  // ── Filtering ─────────────────────────────────────────────
  const filtered = brands.filter(b => {
    const q = search.toLowerCase();
    const matchQ      = !q || b.name.toLowerCase().includes(q) || b.handle.toLowerCase().includes(q);
    const matchPlan   = filterPlan   === 'all' || b.plan   === filterPlan;
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchQ && matchPlan && matchStatus;
  });

  const totalRevenue = brands.reduce((s, b) => s + (b.revenue ?? 0), 0);
  const activeCount  = brands.filter(b => b.status === 'active').length;
  const flaggedCount = brands.filter(b => b.flagged).length;

  // Live-updated selected from brands state
  const liveSelected = selected ? brands.find(b => b.id === selected.id) ?? null : null;
  const liveEditing  = editing && typeof editing !== 'string'
    ? brands.find(b => b.id === (editing as Brand).id) ?? null
    : null;

  // ── Row renderer ──────────────────────────────────────────
  const renderBrand = ({ item }: { item: Brand }) => {
    const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
    return (
      <TouchableOpacity
        onPress={() => setSelected(item)}
        activeOpacity={0.75}
        style={s.profileRow}
      >
        <View style={s.avatarWrap}>
          {item.logoUrl
            ? <Image source={{ uri: item.logoUrl }} style={s.rowAvatar} />
            : <View style={[s.rowAvatar, { backgroundColor: item.primaryColor || C.surfaceHigh, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 18 }}>🏷</Text>
              </View>
          }
          <View style={[s.statusDot, { backgroundColor: statusMeta.dot }]} />
        </View>

        <View style={s.rowInfo}>
          <View style={s.rowNameLine}>
            <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
            {item.isVerified && <Text style={s.rowVerified}> ✓</Text>}
            {item.flagged    && <Text style={s.rowFlagged}>  ⚑</Text>}
            {item.isLive     && <Text style={{ color: C.like, fontSize: 11 }}>  ●</Text>}
          </View>
          <Text style={s.rowHandle} numberOfLines={1}>{item.handle}  ·  {item.category}</Text>
          <View style={[s.row, { gap: 6, marginTop: 4 }]}>
            <Badge type="plan"   value={item.plan}   />
            <Badge type="status" value={item.status} />
          </View>
        </View>

        <View style={s.rowRight}>
          <LinearGradient
            colors={[item.primaryColor || '#333', item.secondaryColor || '#111']}
            style={s.colorSwatch}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          />
          <Text style={s.rowFollowers}>{fmtNum(item.subscribersCount)}</Text>
          <Text style={s.rowFollowerLabel}>subs</Text>
        </View>

        {deleting === item.id
          ? <ActivityIndicator color={C.primary} style={{ marginLeft: 8 }} />
          : <Text style={s.chevron}>›</Text>
        }
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.topBarLabel}>ADMIN CONSOLE</Text>
          <Text style={s.topBarTitle}>Brand Management</Text>
        </View>
        <View style={s.topBarRight}>
          {flaggedCount > 0 && (
            <View style={s.flagBadge}>
              <Text style={s.flagBadgeText}>{flaggedCount} ⚑</Text>
            </View>
          )}
          {/* Create brand button */}
          <TouchableOpacity
            onPress={() => setCreating(true)}
            style={s.createBtn}
          >
            <Text style={s.createBtnText}>+ Brand</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats strip */}
      {loading
        ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator color={C.primary} /></View>
        : (
          <View style={s.statsStrip}>
            {[
              ['Total',   brands.length,                  C.text  ],
              ['Active',  activeCount,                     C.primary],
              ['MRR',     `$${totalRevenue.toFixed(0)}`,  C.primaryDk],
              ['Flagged', flaggedCount, flaggedCount > 0 ? C.like : C.muted],
            ].map(([l, v, c]) => (
              <View key={l as string} style={s.stripStat}>
                <Text style={[s.stripValue, { color: c as string }]}>{v as any}</Text>
                <Text style={s.stripLabel}>{l as string}</Text>
              </View>
            ))}
          </View>
        )
      }

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search brands…" placeholderTextColor={C.muted}
          style={s.searchInput} autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: C.sub, fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.pillsBar} contentContainerStyle={s.pillsContent}>
        {([
          ['all','All Plans'],['free','Free'],['basic','Basic'],['pro','Pro'],['creator','Creator'],
        ] as [string, string][]).map(([v, l]) => (
          <TouchableOpacity key={v}
            onPress={() => setFilterPlan(v as any)}
            style={[s.pill, filterPlan === v && s.pillActive]}>
            <Text style={[s.pillText, filterPlan === v && s.pillTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.pillDivider} />
        {([
          ['all','All Status'],['active','Active'],['suspended','Suspended'],['pending','Pending'],
        ] as [string, string][]).map(([v, l]) => (
          <TouchableOpacity key={v}
            onPress={() => setFilterStatus(v as any)}
            style={[s.pill, filterStatus === v && s.pillActive]}>
            <Text style={[s.pillText, filterStatus === v && s.pillTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.resultCount}>{filtered.length} of {brands.length} brands</Text>

      {/* Brand list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderBrand}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>◈</Text>
              <Text style={s.emptyText}>
                {brands.length === 0 ? 'No brands yet — create one above' : 'No brands match your filters'}
              </Text>
            </View>
          )
        }
      />

      {/* Detail sheet */}
      {liveSelected && (
        <DetailSheet
          brand={liveSelected}
          onEdit={b => { setSelected(null); setTimeout(() => setEditing(b), 300); }}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onVerify={handleVerify}
          onFlag={handleFlag}
          onDelete={handleDelete}
        />
      )}

      {/* Edit sheet */}
      {liveEditing && (
        <EditSheet
          brand={liveEditing}
          onSave={(data) => handleSave(data)}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* Create sheet */}
      {creating && (
        <EditSheet
          brand={null}
          onSave={(data, creds) => handleSave(data, creds)}
          onClose={() => setCreating(false)}
          saving={saving}
        />
      )}

      {/* Toast */}
      {toast && (
        <View style={[
          s.toast,
          { backgroundColor: toast.ok ? '#2f251acb' : '#2f1a1a', borderColor: toast.ok ? C.primary : C.like },
        ]}>
          <Text style={[s.toastText, { color: toast.ok ? C.primary : C.like }]}>
            {toast.ok ? '✓' : '⚑'}  {toast.msg}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg, top: 24 },
  row:           { flexDirection: 'row', alignItems: 'center' },

  topBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarLabel:   { fontSize: 10, color: C.primary, letterSpacing: 2, marginBottom: 3 },
  topBarTitle:   { fontSize: 22, fontWeight: '800', color: C.text },
  topBarRight:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flagBadge:     { backgroundColor: '#2f1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.like },
  flagBadgeText: { color: C.like, fontSize: 11, fontWeight: '700' },
  createBtn:     { backgroundColor: '#2f251acb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.primary },
  createBtnText: { color: C.primary, fontSize: 12, fontWeight: '700' },

  statsStrip:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  stripStat:     { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: C.border },
  stripValue:    { fontSize: 20, fontWeight: '800' },
  stripLabel:    { fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },

  searchWrap:    { flexDirection: 'row', alignItems: 'center', margin: 14, backgroundColor: C.surfaceHigh, borderRadius: 12, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12 },
  searchIcon:    { fontSize: 16, color: C.sub, marginRight: 6 },
  searchInput:   { flex: 1, color: C.text, fontSize: 14, paddingVertical: 11 },

  pillsBar:      { flexGrow: 0 },
  pillsContent:  { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  pill:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border2 },
  pillActive:    { backgroundColor: '#2f251acb', borderColor: C.primary },
  pillText:      { fontSize: 12, color: C.sub, fontWeight: '600' },
  pillTextActive:{ color: C.primary },
  pillDivider:   { width: 1, backgroundColor: C.border2, alignSelf: 'stretch', marginHorizontal: 4 },

  resultCount:   { fontSize: 11, color: C.muted, paddingHorizontal: 20, marginBottom: 6 },

  listContent:   { paddingHorizontal: 14, paddingBottom: 30 },
  profileRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, borderRadius: 14, padding: 14, gap: 12 },
  separator:     { height: 8 },
  avatarWrap:    { position: 'relative' },
  rowAvatar:     { width: 48, height: 48, borderRadius: 12 },
  statusDot:     { position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.bg },
  rowInfo:       { flex: 1 },
  rowNameLine:   { flexDirection: 'row', alignItems: 'center' },
  rowName:       { fontSize: 14, fontWeight: '700', color: C.text, flexShrink: 1 },
  rowVerified:   { fontSize: 12, color: C.primary },
  rowFlagged:    { fontSize: 12, color: C.like },
  rowHandle:     { fontSize: 11, color: C.sub, marginTop: 1 },
  rowRight:      { alignItems: 'center', gap: 3 },
  colorSwatch:   { width: 8, height: 36, borderRadius: 4 },
  rowFollowers:  { fontSize: 13, fontWeight: '700', color: C.text },
  rowFollowerLabel: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  chevron:       { fontSize: 20, color: C.muted },

  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:     { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheetWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:         { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, maxHeight: SH * 0.92, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetLabel:    { fontSize: 10, color: C.primary, letterSpacing: 2, marginBottom: 3 },
  sheetTitle:    { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:  { color: C.sub, fontSize: 14 },

  colorPreview:      { margin: 16, borderRadius: 14, padding: 20, height: 80, justifyContent: 'flex-end' },
  colorPreviewText:  { color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.9 },
  colorPreviewSub:   { color: '#fff', fontSize: 10, opacity: 0.6, marginTop: 2 },
  fieldGroup:        { paddingHorizontal: 16, marginBottom: 14 },
  fieldLabel:        { fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:             { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border2, borderRadius: 10, color: C.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  cycleBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycleTap:          { fontSize: 10, color: C.muted },
  toggleBtn:         { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border2, alignItems: 'center' },
  toggleText:        { fontSize: 13, fontWeight: '600', color: C.sub },
  saveBtn:           { margin: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:       { color: C.bg, fontSize: 15, fontWeight: '800' },

  detailHero:        { height: 120, margin: 16, borderRadius: 16, justifyContent: 'flex-end', padding: 12 },
  verifiedChip:      { position: 'absolute', top: 12, right: 12, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedChipText:  { color: C.bg, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  detailAvatarWrap:  { marginTop: -28, marginLeft: 24, marginBottom: 10 },
  detailAvatar:      { width: 60, height: 60, borderRadius: 16, borderWidth: 3, borderColor: C.surface },
  detailBody:        { paddingHorizontal: 20 },
  detailNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailName:        { fontSize: 22, fontWeight: '800', color: C.text },
  detailHandle:      { fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 2 },
  detailBio:         { fontSize: 13, color: C.sub, lineHeight: 20, marginVertical: 10 },
  detailWebsite:     { fontSize: 12, color: C.primaryLt, marginBottom: 14 },
  detailMeta:        { fontSize: 10, color: C.muted, marginVertical: 14, lineHeight: 16 },
  statsRow:          { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:          { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  statLabel:         { fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue:         { fontSize: 16, fontWeight: '800' },

  actionBtnPrimary:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionBtnPrimaryText: { color: C.bg, fontSize: 14, fontWeight: '800' },
  actionBtnOutline:     { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '600', color: C.sub },

  toast:         { position: 'absolute', bottom: 32, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  toastText:     { fontSize: 13, fontWeight: '700' },

  emptyWrap:     { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyIcon:     { fontSize: 36, color: C.muted },
  emptyText:     { fontSize: 14, color: C.muted, textAlign: 'center', paddingHorizontal: 40 },
});
