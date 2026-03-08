// ============================================================
// app/screens/AuthScreen.tsx
// Login · Register · Reset Password
// Firebase Auth wired — matches app cognac/gold palette
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Platform, Animated, KeyboardAvoidingView,
  ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

const { width: W } = Dimensions.get('window');

// ─── Tokens ───────────────────────────────────────────────────
const C = {
  bg:          '#0d0806',
  surface:     '#120a07',
  surfaceHigh: '#1a0e09',
  border:      '#2e1a0e',
  borderLit:   '#6a3a1e',
  text:        '#f5ede6',
  textSub:     '#c4a090',
  sub:         '#8a6050',
  muted:       '#4a2e20',
  primary:     '#9B5035',
  primaryDk:   '#7D3F2A',
  primaryLt:   '#B8704E',
  gold:        '#C8901A',
  goldLt:      '#E8A820',
  goldBg:      'rgba(200,144,26,0.07)',
  error:       '#c0443a',
  green:       '#5a9e6a',
};

type Mode = 'login' | 'register' | 'reset';

// ─── Floating-label Input ─────────────────────────────────────
interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  keyboard?: 'default' | 'email-address';
  capitalize?: 'none' | 'words';
  error?: string;
  onSubmit?: () => void;
  returnKey?: 'next' | 'done' | 'go';
  nextRef?: React.RefObject<TextInput>;
  inputRef?: React.RefObject<TextInput>;
}
const FloatInput: React.FC<InputProps> = ({
  label, value, onChange, secure = false, keyboard = 'default',
  capitalize = 'none', error, onSubmit, returnKey = 'next',
  nextRef, inputRef,
}) => {
  const [focused,  setFocused]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused || !!value ? 1 : 0,
      useNativeDriver: false, tension: 140, friction: 12,
    }).start();
  }, [focused, value]);

  const labelTop   = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 6] });
  const labelSize  = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 10] });
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.sub, focused ? C.goldLt : C.sub],
  });

  return (
    <View style={iS.wrap}>
      <View style={[iS.box, focused && iS.boxFocus, !!error && iS.boxError]}>
        <Animated.Text style={[iS.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
          {label}
        </Animated.Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure && !showPass}
          keyboardType={keyboard}
          autoCapitalize={capitalize}
          autoCorrect={false}
          style={iS.input}
          placeholderTextColor="transparent"
          selectionColor={C.gold}
          returnKeyType={returnKey}
          onSubmitEditing={() => {
            if (nextRef?.current) nextRef.current.focus();
            else onSubmit?.();
          }}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setShowPass(p => !p)}
            style={iS.eye}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ fontSize: 15 }}>{showPass ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
        {focused && <View style={iS.glow} />}
      </View>
      {!!error && <Text style={iS.errTxt}>{error}</Text>}
    </View>
  );
};

const iS = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  box: {
    height: 58, backgroundColor: C.surfaceHigh,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 16, justifyContent: 'flex-end',
    position: 'relative', overflow: 'hidden',
  },
  boxFocus: { borderColor: C.gold + '70' },
  boxError: { borderColor: C.error + '80' },
  label: {
    position: 'absolute', left: 16,
    letterSpacing: 0.4, fontWeight: '600',
  },
  input: {
    height: 30, color: C.text, fontSize: 15,
    paddingBottom: 2, paddingRight: 38,
  },
  eye:    { position: 'absolute', right: 14, bottom: 13 },
  glow:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.gold, opacity: 0.5 },
  errTxt: { color: C.error, fontSize: 11, marginTop: 4, marginLeft: 4, letterSpacing: 0.3 },
});

// ─── Toast ────────────────────────────────────────────────────
interface ToastProps { msg: string; type: 'error' | 'success'; }
const Toast: React.FC<ToastProps> = ({ msg, type }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, []);
  return (
    <Animated.View style={[
      tS.box,
      type === 'success' ? tS.success : tS.error,
      { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }], opacity: anim },
    ]}>
      <Text style={tS.icon}>{type === 'success' ? '✓' : '✕'}</Text>
      <Text style={tS.msg}>{msg}</Text>
    </Animated.View>
  );
};
const tS = StyleSheet.create({
  box:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 10, marginBottom: 20, borderWidth: 1 },
  success: { backgroundColor: 'rgba(90,158,106,0.12)', borderColor: 'rgba(90,158,106,0.35)' },
  error:   { backgroundColor: 'rgba(192,68,58,0.12)',  borderColor: 'rgba(192,68,58,0.35)' },
  icon:    { fontSize: 13, fontWeight: '800', color: C.textSub },
  msg:     { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18 },
});

// ─── Decorative background geometry ──────────────────────────
const BgDecor = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Top-right warm glow */}
    <View style={decS.glowTR} />
    {/* Bottom-left accent */}
    <View style={decS.glowBL} />
    {/* Diagonal rule */}
    <View style={decS.diagLine} />
    {/* Corner marks */}
    <View style={[decS.corner, decS.cornerTL]} />
    <View style={[decS.corner, decS.cornerBR]} />
    {/* Grid dots */}
    {[...Array(5)].map((_, row) =>
      [...Array(4)].map((_, col) => (
        <View
          key={`${row}-${col}`}
          style={[decS.dot, {
            top:  80 + row * 120,
            left: 24 + col * (W / 4),
            opacity: 0.04 + (row + col) % 3 * 0.015,
          }]}
        />
      ))
    )}
  </View>
);

const decS = StyleSheet.create({
  glowTR: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: C.primary, opacity: 0.07,
  },
  glowBL: {
    position: 'absolute', bottom: -60, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.gold, opacity: 0.05,
  },
  diagLine: {
    position: 'absolute',
    top: 0, right: W * 0.3,
    width: 1, height: '100%',
    backgroundColor: C.border, opacity: 0.6,
    transform: [{ rotate: '8deg' }],
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: C.primaryDk + '80',
  },
  cornerTL: { top: 36, left: 24, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 36, right: 24, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  dot: {
    position: 'absolute', width: 3, height: 3,
    borderRadius: 2, backgroundColor: C.primaryLt,
  },
});

// ─── Mode Tab ─────────────────────────────────────────────────
interface TabProps { label: string; active: boolean; onPress: () => void; }
const ModeTab: React.FC<TabProps> = ({ label, active, onPress }) => {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false, tension: 120, friction: 14 }).start();
  }, [active]);
  const underlineW = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={tabS.btn}>
      <Text style={[tabS.label, active && tabS.labelActive]}>{label}</Text>
      <Animated.View style={[tabS.underline, { width: underlineW }]} />
    </TouchableOpacity>
  );
};
const tabS = StyleSheet.create({
  btn:          { flex: 1, alignItems: 'center', paddingBottom: 10 },
  label:        { fontSize: 15, fontWeight: '700', color: C.muted, letterSpacing: 0.5 },
  labelActive:  { color: C.text },
  underline:    { height: 2, backgroundColor: C.gold, borderRadius: 1, marginTop: 6 },
});

// ─── Primary button ───────────────────────────────────────────
interface PrimaryBtnProps { label: string; onPress: () => void; loading?: boolean; }
const PrimaryBtn: React.FC<PrimaryBtnProps> = ({ label, onPress, loading }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[pbS.btn, { transform: [{ scale }] }]}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={pbS.label}>{label}</Text>
        }
      </Animated.View>
    </TouchableOpacity>
  );
};
const pbS = StyleSheet.create({
  btn: {
    height: 56, borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
  label: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
});

// ─── Error map helper ─────────────────────────────────────────
const firebaseMsg = (code: string): string => {
  const map: Record<string, string> = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Try again.',
    'auth/invalid-credential':    'Invalid email or password.',
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/weak-password':         'Password should be at least 6 characters.',
    'auth/too-many-requests':     'Too many attempts. Please wait and try again.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/invalid-email':         'Please enter a valid email address.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
};

// ─── Main Component ───────────────────────────────────────────
export interface AuthScreenProps { onAuthSuccess?: () => void; }

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode]       = useState<Mode>('login');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [toast, setToast]     = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  // Input refs for keyboard tab-through
  const emailRef = useRef<TextInput>(null);
  const passRef  = useRef<TextInput>(null);

  // Entrance animation
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1, useNativeDriver: true,
      tension: 55, friction: 12, delay: 80,
    }).start();
  }, []);

  // Content fade when switching mode
  const fade = useRef(new Animated.Value(1)).current;
  const switchMode = (next: Mode) => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setMode(next);
      setErrors({});
      setToast(null);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())                         e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email))     e.email = 'Enter a valid email';
    if (mode !== 'reset') {
      if (!password)                           e.password = 'Password is required';
      else if (mode === 'register' && password.length < 8)
        e.password = 'Must be at least 8 characters';
    }
    if (mode === 'register' && !name.trim())   e.name = 'Display name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess?.();

      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Create Firestore user document matching the User type
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid:                   cred.user.uid,
          email:                 email.trim().toLowerCase(),
          username:              name.trim().toLowerCase().replace(/\s+/g, '_'),
          displayName:           name.trim(),
          bio:                   '',
          avatarUrl:             '',
          website:               '',
          isVerified:            false,
          isPrivate:             false,
          followersCount:        0,
          followingCount:        0,
          postsCount:            0,
          subscriptionTier:      'free',
          subscriptionStatus:    'none',
          subscriptionExpiresAt: null,
          createdAt:             serverTimestamp(),
          updatedAt:             serverTimestamp(),
        });
        onAuthSuccess?.();

      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        showToast('Reset link sent — check your inbox.', 'success');
      }
    } catch (err: any) {
      showToast(firebaseMsg(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  const cardTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <BgDecor />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Wordmark ── */}
          <Animated.View style={[s.header, {
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }]}>
            {/* Gold accent rule */}
            <View style={s.rule} />

            <Text style={s.wordmark}>BRANDCO</Text>
            <Text style={s.tagline}>✦  THE BRAND UNIVERSE  ✦</Text>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View style={[s.card, {
            opacity: enter,
            transform: [{ translateY: cardTranslate }],
          }]}>
            {/* Mode tabs — only for login/register */}
            {mode !== 'reset' && (
              <View style={s.tabs}>
                <ModeTab label="Sign In"  active={mode === 'login'}    onPress={() => switchMode('login')} />
                <ModeTab label="Register" active={mode === 'register'} onPress={() => switchMode('register')} />
              </View>
            )}

            {/* Reset mode back link */}
            {mode === 'reset' && (
              <TouchableOpacity onPress={() => switchMode('login')} style={s.backRow}>
                <Text style={s.backText}>← Back to sign in</Text>
              </TouchableOpacity>
            )}

            <Animated.View style={{ opacity: fade }}>
              {/* Toast */}
              {toast && <Toast msg={toast.msg} type={toast.type} />}

              {/* ── Register extra field ── */}
              {mode === 'register' && (
                <FloatInput
                  label="Display Name"
                  value={name}
                  onChange={setName}
                  capitalize="words"
                  error={errors.name}
                  returnKey="next"
                  nextRef={emailRef as React.RefObject<TextInput>}
                />
              )}

              <FloatInput
                label="Email address"
                value={email}
                onChange={setEmail}
                keyboard="email-address"
                error={errors.email}
                returnKey="next"
                inputRef={emailRef as React.RefObject<TextInput>}
                nextRef={mode !== 'reset' ? passRef as React.RefObject<TextInput> : undefined}
                onSubmit={mode === 'reset' ? handleSubmit : undefined}
              />

              {mode !== 'reset' && (
                <FloatInput
                  label="Password"
                  value={password}
                  onChange={setPass}
                  secure
                  error={errors.password}
                  returnKey="done"
                  inputRef={passRef as React.RefObject<TextInput>}
                  onSubmit={handleSubmit}
                />
              )}

              {/* Forgot password */}
              {mode === 'login' && (
                <TouchableOpacity
                  onPress={() => switchMode('reset')}
                  style={s.forgotRow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Reset description */}
              {mode === 'reset' && (
                <Text style={s.resetDesc}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
              )}

              {/* Submit */}
              <View style={{ marginTop: 8 }}>
                <PrimaryBtn
                  onPress={handleSubmit}
                  loading={loading}
                  label={
                    mode === 'login'    ? 'Sign In →' :
                    mode === 'register' ? 'Create Account →' :
                    'Send Reset Link →'
                  }
                />
              </View>

              {/* Divider + social — only for login/register */}
              {mode !== 'reset' && (
                <>
                  <View style={s.orRow}>
                    <View style={s.orLine} />
                    <Text style={s.orText}>OR</Text>
                    <View style={s.orLine} />
                  </View>

                  {/* Google sign-in placeholder */}
                  <TouchableOpacity
                    style={s.socialBtn}
                    activeOpacity={0.8}
                    onPress={() => showToast('Google sign-in coming soon.', 'success')}
                  >
                    <Text style={s.socialIcon}>G</Text>
                    <Text style={s.socialLabel}>Continue with Google</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </Animated.View>

          {/* Footer */}
          <Animated.Text style={[s.footer, { opacity: enter }]}>
            By continuing you agree to our{' '}
            <Text style={s.footerLink}>Terms</Text>
            {' '}and{' '}
            <Text style={s.footerLink}>Privacy Policy</Text>
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Wordmark
  header: { alignItems: 'center', marginBottom: 40 },
  rule: {
    width: 48, height: 2,
    backgroundColor: C.gold,
    borderRadius: 1,
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 38,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 10,
    color: C.gold,
    letterSpacing: 3,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 24,
  },

  // Reset back link
  backRow: { marginBottom: 20 },
  backText: { color: C.primary, fontSize: 13, fontWeight: '600' },

  // Forgot
  forgotRow: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 16 },
  forgotText: { color: C.sub, fontSize: 12.5, fontWeight: '600' },

  // Reset description
  resetDesc: {
    color: C.sub, fontSize: 13.5, lineHeight: 20,
    marginBottom: 20, letterSpacing: 0.2,
  },

  // Or divider
  orRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { color: C.muted, fontSize: 11, paddingHorizontal: 12, fontWeight: '700', letterSpacing: 1.5 },

  // Social
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1.5, borderColor: C.border,
    gap: 12,
  },
  socialIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.border,
    textAlign: 'center', lineHeight: 26,
    fontSize: 13, fontWeight: '900', color: C.textSub,
    overflow: 'hidden',
  },
  socialLabel: { fontSize: 14, fontWeight: '600', color: C.textSub, letterSpacing: 0.2 },

  // Footer
  footer:     { textAlign: 'center', fontSize: 11.5, color: C.muted, marginTop: 24, lineHeight: 18 },
  footerLink: { color: C.sub, fontWeight: '700' },
});

export default AuthScreen;
