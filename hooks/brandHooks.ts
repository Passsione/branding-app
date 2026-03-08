// hooks/brandHooks.ts
// =====================================================
// BRAND HOOKS
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brand,
  subscribeToBrands,
  subscribeToAdminBrands,
  getBrandPosts,
  toggleBrandSubscription,
  isBrandSubscribed,
  createBrand,
  updateBrand,
  deleteBrand,
  ADMIN_UID,
} from '../services/brandService';
import { auth } from '../firebase/config';

// ── Public brands (feed carousel) ────────────────────────────
export const useBrands = () => {
  const [brands, setBrands]   = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToBrands(b => { setBrands(b); setLoading(false); });
    return unsub;
  }, []);

  return { brands, loading };
};

// ── Admin brands (all, including suspended) ───────────────────
export const useAdminBrands = () => {
  const [brands, setBrands]   = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAdminBrands(b => { setBrands(b); setLoading(false); });
    return unsub;
  }, []);

  return { brands, loading };
};

// ── Per-brand subscription state ──────────────────────────────
export const useBrandSubscription = (brandId: string) => {
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    isBrandSubscribed(brandId).then(setSubscribed);
  }, [brandId]);

  const toggle = useCallback(async () => {
    setLoading(true);
    const result = await toggleBrandSubscription(brandId);
    setSubscribed(result);
    setLoading(false);
  }, [brandId]);

  return { subscribed, toggle, loading };
};

// ── Brand posts ───────────────────────────────────────────────
export const useBrandPosts = (brandId: string) => {
  const [posts,   setPosts]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrandPosts(brandId).then(p => { setPosts(p); setLoading(false); });
  }, [brandId]);

  return { posts, loading };
};

// ── Is current user admin ─────────────────────────────────────
export const useIsAdmin = () => auth.currentUser?.uid === ADMIN_UID;

// ── Admin CRUD actions (used inside AdminDashboard) ───────────
export const useAdminBrandActions = () => {
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const create = useCallback(async (
    data: Parameters<typeof createBrand>[0],
    credentials: { email: string; password: string },
  ) => {
    setSaving(true);
    try { return await createBrand(data, credentials); }
    finally { setSaving(false); }
  }, []);

  const update = useCallback(async (id: string, data: Parameters<typeof updateBrand>[1]) => {
    setSaving(true);
    try { await updateBrand(id, data); }
    finally { setSaving(false); }
  }, []);

  const remove = useCallback(async (id: string) => {
    setDeleting(id);
    try { await deleteBrand(id); }
    finally { setDeleting(null); }
  }, []);

  return { create, update, remove, saving, deleting };
};
