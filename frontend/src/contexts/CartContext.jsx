import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDiscountedPrice } from '../lib/format.js';
import { storage } from '../lib/storage.js';
import { apiFetch } from '../lib/api.js';
import { getPublicSessionToken } from '../lib/publicSession.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'miami-closet-cart';
const OWNER_STORAGE_KEY = 'miami-closet-cart-owner';

function clampQuantity(quantity, maxQuantity) {
  const safeQuantity = Math.max(1, Number(quantity || 1));
  if (Number.isFinite(maxQuantity) && maxQuantity >= 0) {
    return Math.min(safeQuantity, maxQuantity);
  }
  return safeQuantity;
}

function readStoredItems() {
  const stored = storage.get(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function normalizeRemoteItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    articleId: item.articleId,
    slug: item.slug,
    title: item.title,
    brandName: item.brandName,
    sizeLabel: item.sizeLabel || '',
    image: item.image || '',
    salePrice: Number(item.salePrice || 0),
    discountType: item.discountType || 'NONE',
    discountValue: Number(item.discountValue || 0),
    discountedPrice: Number(item.discountedPrice || 0),
    quantity: Number(item.quantity || 1),
    maxQuantity: Number(item.maxQuantity || item.quantity || 1),
  }));
}

export function CartProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [items, setItems] = useState(() => readStoredItems());
  const [cartOwnerId, setCartOwnerId] = useState(() => storage.get(OWNER_STORAGE_KEY, null));
  const [cartFx, setCartFx] = useState({ tick: 0, articleId: null, title: '', sourceRect: null });
  const syncQueueRef = useRef(Promise.resolve());
  const syncedUserIdRef = useRef(null);

  function persist(nextItems, ownerId = cartOwnerId) {
    setItems(nextItems);
    setCartOwnerId(ownerId);
    storage.set(STORAGE_KEY, nextItems);
    storage.set(OWNER_STORAGE_KEY, ownerId);
  }

  function enqueueSync(task) {
    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(task)
      .catch(() => undefined);
    return syncQueueRef.current;
  }

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user?.id) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === user.id) {
      return;
    }

    syncedUserIdRef.current = user.id;
    const shouldMergeLocal = items.length > 0 && String(cartOwnerId || '') !== String(user.id);

    void enqueueSync(async () => {
      if (shouldMergeLocal) {
        for (const item of items) {
          await apiFetch('/api/cart/items', {
            method: 'POST',
            body: {
              articleId: item.articleId,
              quantity: item.quantity,
            },
          });
        }
      }

      const response = await apiFetch('/api/cart');
      persist(normalizeRemoteItems(response.cart?.items || []), user.id);
    });
  }, [authLoading, cartOwnerId, isAuthenticated, items, user?.id]);

  const value = useMemo(
    () => ({
      items,
      addItem(article, quantity = 1, options = {}) {
        const maxQuantity = Math.max(0, Number(article.quantityAvailable ?? article.maxQuantity ?? 0));
        const existing = items.find((item) => item.articleId === article.id);
        const existingQuantity = Number(existing?.quantity || 0);

        if (maxQuantity <= 0) {
          return { ok: false, code: 'OUT_OF_STOCK', maxQuantity: 0, quantity: existingQuantity };
        }

        const desiredQuantity = existingQuantity + Math.max(1, Number(quantity || 1));
        const nextQuantity = clampQuantity(desiredQuantity, maxQuantity);
        const reachedLimit = nextQuantity < desiredQuantity;

        setCartFx({
          tick: Date.now(),
          articleId: article.id,
          title: article.title,
          sourceRect: options.sourceRect || null,
        });

        let nextItems;

        if (existing) {
          nextItems = items.map((item) => (
            item.articleId === article.id
              ? { ...item, quantity: nextQuantity, maxQuantity }
              : item
          ));
        } else {
          const newItem = {
            id: existing?.id || null,
            articleId: article.id,
            slug: article.slug,
            title: article.title,
            brandName: article.brandName,
            sizeLabel: article.sizeText || article.sizeCode || '',
            image: article.primaryImage || article.images?.[0]?.filePath || article.images?.[0]?.file_path || '',
            salePrice: Number(article.salePrice || 0),
            discountType: article.discountType || 'NONE',
            discountValue: Number(article.discountValue || 0),
            discountedPrice: getDiscountedPrice(article),
            quantity: nextQuantity,
            maxQuantity,
          };

          nextItems = [...items, newItem];
        }

        persist(nextItems, isAuthenticated ? user?.id || cartOwnerId : null);

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const response = await apiFetch('/api/cart/items', {
              method: 'POST',
              body: {
                articleId: article.id,
                quantity: Math.max(1, Number(quantity || 1)),
              },
            });

            persist(normalizeRemoteItems(response.cart?.items || []), user.id);
          });
        }

        void apiFetch('/api/public/article-events', {
          method: 'POST',
          body: {
            articleId: article.id,
            eventType: 'ADD_TO_CART',
            sessionToken: getPublicSessionToken(),
          },
        }).catch(() => undefined);

        return {
          ok: !reachedLimit,
          code: reachedLimit ? 'LIMITED' : existing ? 'UPDATED' : 'ADDED',
          maxQuantity,
          quantity: nextQuantity,
        };
      },
      removeItem(articleId) {
        const nextItems = items.filter((item) => item.articleId !== articleId);
        persist(nextItems, isAuthenticated ? user?.id || cartOwnerId : null);

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const snapshot = await apiFetch('/api/cart');
            const remoteItem = (snapshot.cart?.items || []).find((item) => item.articleId === articleId);

            if (!remoteItem) {
              persist(normalizeRemoteItems(snapshot.cart?.items || []), user.id);
              return;
            }

            const response = await apiFetch(`/api/cart/items/${remoteItem.id}`, {
              method: 'DELETE',
            });

            persist(normalizeRemoteItems(response.cart?.items || []), user.id);
          });
        }
      },
      updateQuantity(articleId, quantity) {
        const existing = items.find((item) => item.articleId === articleId);
        if (!existing) {
          return { ok: false, code: 'NOT_FOUND', quantity: 0, maxQuantity: 0 };
        }

        const maxQuantity = Math.max(1, Number(existing.maxQuantity || existing.quantity || 1));
        const desiredQuantity = Math.max(1, Number(quantity || 1));
        const nextQuantity = clampQuantity(desiredQuantity, maxQuantity);
        const limited = nextQuantity < desiredQuantity;

        persist(
          items.map((item) => (
            item.articleId === articleId ? { ...item, quantity: nextQuantity, maxQuantity } : item
          )),
          isAuthenticated ? user?.id || cartOwnerId : null,
        );

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const snapshot = await apiFetch('/api/cart');
            const remoteItem = (snapshot.cart?.items || []).find((item) => item.articleId === articleId);

            if (!remoteItem) {
              const added = await apiFetch('/api/cart/items', {
                method: 'POST',
                body: { articleId, quantity: nextQuantity },
              });
              persist(normalizeRemoteItems(added.cart?.items || []), user.id);
              return;
            }

            const response = await apiFetch(`/api/cart/items/${remoteItem.id}`, {
              method: 'PATCH',
              body: { quantity: nextQuantity },
            });

            persist(normalizeRemoteItems(response.cart?.items || []), user.id);
          });
        }

        return {
          ok: !limited,
          code: limited ? 'LIMITED' : 'UPDATED',
          quantity: nextQuantity,
          maxQuantity,
        };
      },
      clearCart() {
        persist([], isAuthenticated ? user?.id || cartOwnerId : null);

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const response = await apiFetch('/api/cart', {
              method: 'DELETE',
            });
            persist(normalizeRemoteItems(response.cart?.items || []), user.id);
          });
        }
      },
      isInCart(articleId) {
        return items.some((item) => item.articleId === articleId);
      },
      getItem(articleId) {
        return items.find((item) => item.articleId === articleId) || null;
      },
      cartCount: items.reduce((sum, item) => sum + item.quantity, 0),
      cartFx,
      subtotal: items.reduce((sum, item) => sum + Number(item.discountedPrice || 0) * item.quantity, 0),
    }),
    [cartFx, cartOwnerId, isAuthenticated, items, user?.id],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
