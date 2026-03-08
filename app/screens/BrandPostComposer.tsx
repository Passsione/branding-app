// ============================================================
// app/screens/BrandPostComposer.tsx
//
// Full-screen post composer for brand owners.
// Media is picked from device (photo library / files) and
// uploaded to Firebase Storage before the post is written.
//
// Dependencies (all already in a standard Expo project):
//   expo-image-picker    — photo library + camera
//   expo-document-picker — video / file picker
//   firebase/storage     — upload to gs://your-bucket/posts/
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, Modal, Platform,
  Dimensions, KeyboardAvoidingView,
  ActivityIndicator, Alert, SafeAreaView, StatusBar,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import * as ImagePicker      from 'expo-image-picker';
import * as DocumentPicker   from 'expo-document-picker';
import {
  ref, uploadBytesResumable, getDownloadURL,
} from 'firebase/storage';
import {
  collection, doc, addDoc, updateDoc,
  serverTimestamp, increment,
} from 'firebase/firestore';

import { auth, db, storage } from '../../firebase/config';
import { Brand }             from '../../services/brandService';
import { PostType, MediaItem } from '../../types';

// ─────────────────────────────────────────────────────────────
// NOTE: Make sure your firebase/config exports `storage`:
//   export const storage = getStorage(app);
// ─────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

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
};

// ── Helpers ───────────────────────────────────────────────────
const extractTags     = (t: string) => (t.match(/#(\w+)/g) ?? []).map(h => h.slice(1).toLowerCase());
const extractMentions = (t: string) => (t.match(/@(\w+)/g) ?? []).map(m => m.slice(1).toLowerCase());

const FL: React.FC<{ children: string; gold?: boolean }> = ({ children, gold }) => (
  <Text style={[s.fieldLabel, gold && { color: C.gold }]}>{children}</Text>
);

// ── Post type config ──────────────────────────────────────────
const POST_TYPES: { type: PostType; label: string; icon: string; multi: boolean }[] = [
  { type: 'image',    label: 'Image',    icon: '🖼',  multi: false },
  { type: 'video',    label: 'Video',    icon: '▶',  multi: false },
  { type: 'carousel', label: 'Carousel', icon: '⧉',  multi: true  },
  { type: 'reel',     label: 'Reel',     icon: '🎵',  multi: false },
];

// ── Media item state ──────────────────────────────────────────
interface MediaDraft {
  localUri:     string;          // local file URI from picker
  remoteUrl:    string;          // filled after upload
  type:         'image' | 'video';
  mimeType:     string;
  width?:       number;
  height?:      number;
  uploadProgress: number;        // 0–1
  uploading:    boolean;
  error?:       string;
}

const blankDraft = (type: 'image' | 'video'): MediaDraft => ({
  localUri: '', remoteUrl: '', type, mimeType: '',
  uploadProgress: 0, uploading: false,
});

// ── Upload a single file to Firebase Storage ─────────────────
async function uploadToStorage(
  draft:       MediaDraft,
  onProgress:  (p: number) => void,
): Promise<string> {
  const uid      = auth.currentUser?.uid ?? 'unknown';
  const ext      = draft.localUri.split('.').pop() ?? (draft.type === 'video' ? 'mp4' : 'jpg');
  const filename = `posts/${uid}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, filename);

  // Fetch the local file as a blob
  const response = await fetch(draft.localUri);
  const blob     = await response.blob();

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: draft.mimeType || (draft.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
    task.on(
      'state_changed',
      snap => onProgress(snap.bytesTransferred / snap.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

// ── Media picker card ─────────────────────────────────────────
interface MediaCardProps {
  draft:      MediaDraft;
  index:      number;
  postType:   PostType;
  canRemove:  boolean;
  onPick:     (i: number, type: 'image' | 'video') => void;
  onRemove:   (i: number) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({
  draft, index, postType, canRemove, onPick, onRemove,
}) => {
  const hasFile    = !!draft.localUri;
  const isVideo    = draft.type === 'video';
  const isUploading = draft.uploading;
  const isDone     = !!draft.remoteUrl;
  const hasError   = !!draft.error;

  // For carousel allow both types; for dedicated types fix it
  const showTypePicker = postType === 'carousel';

  return (
    <View style={s.card}>
      {/* Preview / pick area */}
      <TouchableOpacity
        onPress={() => !isUploading && onPick(index, draft.type)}
        activeOpacity={0.8}
        style={s.cardPreview}
      >
        {hasFile ? (
          <>
            <Image
              source={{ uri: draft.localUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Upload progress overlay */}
            {isUploading && (
              <View style={s.uploadOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={s.uploadPct}>
                  {Math.round(draft.uploadProgress * 100)}%
                </Text>
              </View>
            )}
            {/* Done tick */}
            {isDone && !isUploading && (
              <View style={s.doneBadge}>
                <Text style={s.doneBadgeText}>✓</Text>
              </View>
            )}
            {/* Video badge */}
            {isVideo && (
              <View style={s.videoBadge}>
                <Text style={s.videoBadgeText}>▶</Text>
              </View>
            )}
            {/* Error */}
            {hasError && (
              <View style={s.errorOverlay}>
                <Text style={s.errorOverlayText}>⚠ Retry</Text>
              </View>
            )}
          </>
        ) : (
          <View style={s.cardEmpty}>
            <Text style={s.cardEmptyIcon}>{isVideo ? '▶' : '+'}</Text>
            <Text style={s.cardEmptyLabel}>
              {isVideo ? 'Pick video' : 'Pick image'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Type toggle (carousel only) */}
      {showTypePicker && (
        <View style={s.cardTypeRow}>
          {(['image', 'video'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => onPick(index, t)}
              style={[s.cardTypeBtn, draft.type === t && s.cardTypeBtnActive]}
            >
              <Text style={[s.cardTypeBtnText, draft.type === t && { color: C.primary }]}>
                {t === 'image' ? '🖼' : '▶'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Remove button */}
      {canRemove && (
        <TouchableOpacity onPress={() => onRemove(index)} style={s.cardRemove}>
          <Text style={s.cardRemoveText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── Main composer ─────────────────────────────────────────────
interface BrandPostComposerProps {
  brand:    Brand;
  onClose:  () => void;
  onPosted: () => void;
}

export default function BrandPostComposer({ brand, onPosted, onClose }: BrandPostComposerProps) {
  const [postType,    setPostType]    = useState<PostType>('image');
  const [caption,     setCaption]     = useState('');
  const [location,    setLocation]    = useState('');
  const [noComments,  setNoComments]  = useState(false);
  const [hideLikes,   setHideLikes]   = useState(false);
  const [publishing,  setPublishing]  = useState(false);

  const currentTypeCfg = POST_TYPES.find(p => p.type === postType)!;

  const [drafts, setDrafts] = useState<MediaDraft[]>([
    blankDraft('image'),
  ]);

  // ── Update a single draft field ──────────────────────────────
  const patchDraft = (i: number, patch: Partial<MediaDraft>) => {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  };

  // ── Pick media ───────────────────────────────────────────────
  const handlePick = useCallback(async (index: number, mediaType: 'image' | 'video') => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library in Settings.');
      return;
    }

    let localUri  = '';
    let mimeType  = '';
    let width     = 0;
    let height    = 0;

    if (mediaType === 'image') {
      // ── Image: use ImagePicker (shows photos + albums) ───────
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      localUri = asset.uri;
      mimeType = asset.mimeType ?? 'image/jpeg';
      width    = asset.width  ?? 0;
      height   = asset.height ?? 0;

    } else {
      // ── Video: use DocumentPicker (works for video files) ────
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      localUri = asset.uri;
      mimeType = asset.mimeType ?? 'video/mp4';
    }

    // Set local URI immediately so preview shows
    patchDraft(index, {
      localUri, mimeType, width, height,
      type: mediaType, remoteUrl: '', uploadProgress: 0,
      uploading: true, error: undefined,
    });

    // Start upload
    try {
      const remoteUrl = await uploadToStorage(
        { ...drafts[index], localUri, mimeType, type: mediaType },
        progress => patchDraft(index, { uploadProgress: progress }),
      );
      patchDraft(index, { remoteUrl, uploading: false, uploadProgress: 1 });
    } catch (e: any) {
      patchDraft(index, { uploading: false, error: e.message ?? 'Upload failed' });
    }
  }, [drafts]);

  // ── Add / remove drafts (carousel) ───────────────────────────
  const addDraft = () => setDrafts(d => [...d, blankDraft('image')]);
  const removeDraft = (i: number) => setDrafts(d => d.filter((_, idx) => idx !== i));

  // ── Post type change ─────────────────────────────────────────
  const handleTypeChange = (t: PostType) => {
    setPostType(t);
    const defaultMedia = t === 'video' || t === 'reel' ? 'video' : 'image';
    setDrafts([blankDraft(defaultMedia)]);
  };

  // ── Publish ──────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    const ready = drafts.filter(d => d.remoteUrl);
    if (ready.length === 0) {
      Alert.alert('No media', 'Pick at least one image or video first.'); return;
    }
    if (drafts.some(d => d.uploading)) {
      Alert.alert('Please wait', 'Media is still uploading…'); return;
    }
    if (drafts.some(d => d.error)) {
      Alert.alert('Upload error', 'One or more files failed to upload. Please re-pick them.'); return;
    }
    if (!caption.trim()) {
      Alert.alert('Missing caption', 'Add a caption before posting.'); return;
    }

    setPublishing(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');

      const mediaItems: MediaItem[] = ready.map(d => ({
        url:          d.remoteUrl,
        thumbnailUrl: undefined,
        type:         d.type,
        width:        d.width  ?? 0,
        height:       d.height ?? 0,
      }));

      const tags     = extractTags(caption);
      const mentions = extractMentions(caption);
      const locationObj = location.trim()
        ? { name: location.trim(), city: '', country: '', lat: 0, lng: 0 }
        : undefined;

      await addDoc(collection(db, 'posts'), {
        authorId:           uid,
        brandId:            brand.id,
        type:               postType,
        media:              mediaItems,
        caption:            caption.trim(),
        tags,
        mentions,
        ...(locationObj ? { location: locationObj } : {}),
        likesCount:         0,
        commentsCount:      0,
        sharesCount:        0,
        viewsCount:         0,
        isArchived:         false,
        isCommentsDisabled: noComments,
        isLikesHidden:      hideLikes,
        createdAt:          serverTimestamp(),
        updatedAt:          serverTimestamp(),
      });

      await Promise.all([
        updateDoc(doc(db, 'brands', brand.id), { postsCount: increment(1) }),
        updateDoc(doc(db, 'users',  uid),       { postsCount: increment(1) }),
      ]);

      onPosted();
    } catch (e: any) {
      Alert.alert('Publish failed', e.message ?? 'Something went wrong');
    } finally {
      setPublishing(false);
    }
  }, [drafts, caption, postType, location, noComments, hideLikes, brand, onPosted]);

  const captionTags     = extractTags(caption);
  const captionMentions = extractMentions(caption);
  const allUploaded     = drafts.every(d => !d.localUri || !!d.remoteUrl);
  const anyUploading    = drafts.some(d => d.uploading);

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} style={s.cancelBtn} disabled={publishing}>
            <Text style={[s.cancelText, publishing && { opacity: 0.4 }]}>Cancel</Text>
          </TouchableOpacity>

          <View style={s.topCenter}>
            {brand.logoUrl
              ? <Image source={{ uri: brand.logoUrl }} style={s.topLogo} />
              : <View style={[s.topLogo, { backgroundColor: brand.primaryColor || C.primaryDk, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 12 }}>🏷</Text>
                </View>
            }
            <Text style={s.topBrandName} numberOfLines={1}>{brand.name}</Text>
          </View>

          <TouchableOpacity
            onPress={handlePublish}
            disabled={publishing || anyUploading}
            style={s.publishBtnWrap}
          >
            <LinearGradient
              colors={[brand.primaryColor || C.primary, brand.secondaryColor || C.primaryDk]}
              style={[s.publishBtn, (publishing || anyUploading) && { opacity: 0.5 }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {publishing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.publishBtnText}>
                    {anyUploading ? 'Uploading…' : 'Post'}
                  </Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
          >

            {/* ── Post type tabs ── */}
            <View style={s.typePicker}>
              {POST_TYPES.map(({ type, label, icon }) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleTypeChange(type)}
                  style={[s.typeTab, postType === type && s.typeTabActive]}
                >
                  <Text style={[s.typeTabIcon, postType === type && { color: brand.primaryColor || C.primary }]}>
                    {icon}
                  </Text>
                  <Text style={[s.typeTabLabel, postType === type && { color: brand.primaryColor || C.primary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Media grid ── */}
            <View style={s.section}>
              <FL>{currentTypeCfg.multi ? `Media  (${drafts.length})` : 'Media'}</FL>

              <View style={s.mediaGrid}>
                {drafts.map((draft, i) => (
                  <MediaCard
                    key={i}
                    draft={draft}
                    index={i}
                    postType={postType}
                    canRemove={drafts.length > 1}
                    onPick={handlePick}
                    onRemove={removeDraft}
                  />
                ))}

                {/* Add slot (carousel only) */}
                {currentTypeCfg.multi && (
                  <TouchableOpacity onPress={addDraft} style={s.addCard}>
                    <Text style={s.addCardIcon}>+</Text>
                    <Text style={s.addCardLabel}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Caption ── */}
            <View style={s.section}>
              <FL>Caption</FL>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                style={[s.input, s.captionInput]}
                placeholderTextColor={C.muted}
                placeholder="Write a caption… #tags @mentions"
                multiline
                textAlignVertical="top"
              />
              {(captionTags.length > 0 || captionMentions.length > 0) && (
                <View style={s.tagPreview}>
                  {captionTags.map(t => (
                    <View key={t} style={s.tagChip}>
                      <Text style={s.tagChipText}>#{t}</Text>
                    </View>
                  ))}
                  {captionMentions.map(m => (
                    <View key={m} style={[s.tagChip, s.mentionChip]}>
                      <Text style={[s.tagChipText, { color: C.primaryLt }]}>@{m}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Location ── */}
            <View style={s.section}>
              <FL>Location (optional)</FL>
              <TextInput
                value={location}
                onChangeText={setLocation}
                style={s.input}
                placeholderTextColor={C.muted}
                placeholder="Add a location…"
              />
            </View>

            {/* ── Options ── */}
            <View style={s.section}>
              <FL>Options</FL>
              <View style={s.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>Disable Comments</Text>
                  <Text style={s.optionSub}>Audience cannot comment on this post</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setNoComments(v => !v)}
                  style={[s.toggle, noComments && s.toggleOn]}
                >
                  <View style={[s.toggleThumb, noComments && s.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              <View style={[s.optionRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>Hide Like Count</Text>
                  <Text style={s.optionSub}>Only you can see the like count</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setHideLikes(v => !v)}
                  style={[s.toggle, hideLikes && s.toggleOn]}
                >
                  <View style={[s.toggleThumb, hideLikes && s.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Brand note ── */}
            <View style={s.noteRow}>
              <LinearGradient
                colors={[brand.primaryColor || C.primaryDk, (brand.secondaryColor || C.bg) + '00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.noteBorder}
              />
              <View style={s.noteBody}>
                <Text style={s.noteTitle}>Posting as {brand.name}</Text>
                <Text style={s.noteSub}>
                  Attributed to {brand.handle}. Media uploads to your brand's storage bucket.
                </Text>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const CARD_SIZE = (SW - 32 - 10) / 3; // 3 columns with gaps

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Top bar
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  cancelBtn:      { minWidth: 60, paddingVertical: 6 },
  cancelText:     { color: C.sub, fontSize: 15, fontWeight: '600' },
  topCenter:      { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  topLogo:        { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: C.border2 },
  topBrandName:   { fontSize: 15, fontWeight: '800', color: C.text, maxWidth: 140 },
  publishBtnWrap: { minWidth: 60, alignItems: 'flex-end' },
  publishBtn:     { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, alignItems: 'center', minWidth: 72 },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Post type tabs
  typePicker:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  typeTab:       { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border2 },
  typeTabActive: { backgroundColor: C.primaryDk + '40', borderColor: C.primary + '80' },
  typeTabIcon:   { fontSize: 18, color: C.muted },
  typeTabLabel:  { fontSize: 10, color: C.muted, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },

  // Sections
  section:    { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  fieldLabel: { fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  // Media grid
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },

  // Individual media card
  card:        { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border2 },
  cardPreview: { flex: 1 },
  cardEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  cardEmptyIcon:  { fontSize: 28, color: C.sub },
  cardEmptyLabel: { fontSize: 10, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },

  // Card overlays
  uploadOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  uploadPct:      { color: '#fff', fontSize: 13, fontWeight: '800' },
  doneBadge:      { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#2a9d4a', alignItems: 'center', justifyContent: 'center' },
  doneBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '900' },
  videoBadge:     { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  videoBadgeText: { color: '#fff', fontSize: 11 },
  errorOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(192,68,58,0.7)', alignItems: 'center', justifyContent: 'center' },
  errorOverlayText:{ color: '#fff', fontSize: 12, fontWeight: '800' },

  // Card type toggle
  cardTypeRow:     { flexDirection: 'row', gap: 3, padding: 4, backgroundColor: C.bg },
  cardTypeBtn:     { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.border2 },
  cardTypeBtnActive:{ borderColor: C.primary, backgroundColor: C.primaryDk + '30' },
  cardTypeBtnText: { fontSize: 13, color: C.muted },

  // Card remove
  cardRemove:     { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  cardRemoveText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Add card button
  addCard:      { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 12, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addCardIcon:  { fontSize: 26, color: C.sub },
  addCardLabel: { fontSize: 10, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },

  // Caption
  input:        { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border2, borderRadius: 10, color: C.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  captionInput: { height: 100, textAlignVertical: 'top', lineHeight: 22 },
  tagPreview:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.primaryDk + '40', borderWidth: 1, borderColor: C.primary + '60' },
  mentionChip:  { backgroundColor: C.primaryDk + '20', borderColor: C.primaryLt + '60' },
  tagChipText:  { color: C.primary, fontSize: 11, fontWeight: '700' },

  // Options
  optionRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  optionLabel:   { fontSize: 14, color: C.text, fontWeight: '600' },
  optionSub:     { fontSize: 11, color: C.muted, marginTop: 2 },
  toggle:        { width: 44, height: 26, borderRadius: 13, backgroundColor: C.muted, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn:      { backgroundColor: C.primary },
  toggleThumb:   { width: 20, height: 20, borderRadius: 10, backgroundColor: C.sub },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // Brand note
  noteRow:    { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  noteBorder: { width: 4 },
  noteBody:   { flex: 1, padding: 12 },
  noteTitle:  { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 2 },
  noteSub:    { fontSize: 11, color: C.sub, lineHeight: 16 },
});
