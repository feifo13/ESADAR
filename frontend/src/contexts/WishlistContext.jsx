import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { getPublicSessionToken } from '../lib/publicSession.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

function normalizeItems(items = []) {
  return items.map((item) => ({
    ...item,
    articleId: Number(item.articleId),
  }));
}

export function WishlistProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState([]);
  const requestIdRef = useRef(0);

  function getWishlistQuery({ includeGuest = false } = {}) {
    if (isAuthenticated) return '';
    if (!includeGuest) return null;
    return `?sessionToken=${encodeURIComponent(getPublicSessionToken())}`;
  }

  const refresh = useCallback(async ({ includeGuest = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError('');
      const query = getWishlistQuery({ includeGuest });
      if (query == null) {
        setLoading(false);
        return [];
      }

      const response = await apiFetch(`/api/public/wishlist${query}`);
      if (requestId !== requestIdRef.current) return [];
      setItems(normalizeItems(response.wishlist?.items || []));
      return response.wishlist?.items || [];
    } catch (err) {
      if (requestId !== requestIdRef.current) return [];
      setError(err.message || 'No pudimos cargar los guardados.');
      setItems([]);
      return [];
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    requestIdRef.current += 1;
    setItems([]);
    setPendingIds([]);
    setError('');

    if (authLoading) {
      setLoading(Boolean(isAuthenticated));
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    void refresh();
  }, [authLoading, isAuthenticated, refresh, user?.id]);

  const ids = useMemo(
    () => new Set(items.map((item) => Number(item.articleId))),
    [items],
  );

  async function addItem(articleId, optimisticItem = null) {
    const numericId = Number(articleId);
    setPendingIds((current) => [...new Set([...current, numericId])]);
    const previousItems = items;

    if (optimisticItem) {
      setItems((current) => (
        current.some((item) => Number(item.articleId) === numericId)
          ? current
          : [normalizeItems([optimisticItem])[0], ...current]
      ));
    }

    try {
      const response = await apiFetch('/api/public/wishlist/items', {
        method: 'POST',
        body: {
          articleId: numericId,
          sessionToken: isAuthenticated ? null : getPublicSessionToken(),
        },
      });
      setItems(normalizeItems(response.wishlist?.items || []));
      setError('');
      return { ok: true };
    } catch (err) {
      setItems(previousItems);
      setError(err.message || 'No pudimos guardar la prenda.');
      return { ok: false, error: err };
    } finally {
      setPendingIds((current) => current.filter((id) => id !== numericId));
    }
  }

  async function removeItem(articleId) {
    const numericId = Number(articleId);
    setPendingIds((current) => [...new Set([...current, numericId])]);
    const previousItems = items;
    setItems((current) => current.filter((item) => Number(item.articleId) !== numericId));

    try {
      const query = isAuthenticated
        ? ''
        : `?sessionToken=${encodeURIComponent(getPublicSessionToken())}`;
      const response = await apiFetch(
        `/api/public/wishlist/items/${numericId}${query}`,
        { method: 'DELETE' },
      );
      setItems(normalizeItems(response.wishlist?.items || []));
      setError('');
      return { ok: true };
    } catch (err) {
      setItems(previousItems);
      setError(err.message || 'No pudimos quitar la prenda.');
      return { ok: false, error: err };
    } finally {
      setPendingIds((current) => current.filter((id) => id !== numericId));
    }
  }

  async function toggleItem(article, optimisticItem = null) {
    const articleId = article.id || article.articleId;
    if (ids.has(Number(articleId))) {
      return removeItem(articleId);
    }

    return addItem(articleId, optimisticItem);
  }

  const value = useMemo(
    () => ({
      items,
      ids,
      loading,
      error,
      pendingIds,
      isSaved(articleId) {
        return ids.has(Number(articleId));
      },
      addItem,
      removeItem,
      toggleItem,
      refresh,
    }),
    [addItem, error, ids, items, loading, pendingIds, refresh, removeItem, toggleItem],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used inside WishlistProvider');
  return context;
}
