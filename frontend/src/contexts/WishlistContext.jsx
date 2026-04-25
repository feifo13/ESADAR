import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState([]);

  async function refresh() {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch(`/api/public/wishlist?sessionToken=${encodeURIComponent(getPublicSessionToken())}`);
      setItems(normalizeItems(response.wishlist?.items || []));
      return response.wishlist?.items || [];
    } catch (err) {
      setError(err.message || 'No pudimos cargar los guardados.');
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [isAuthenticated, user?.id]);

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
          sessionToken: getPublicSessionToken(),
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
      const response = await apiFetch(
        `/api/public/wishlist/items/${numericId}?sessionToken=${encodeURIComponent(getPublicSessionToken())}`,
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
