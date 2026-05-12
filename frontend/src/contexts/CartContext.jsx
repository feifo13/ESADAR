import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDiscountedPrice } from '../lib/format.js';
import { storage } from '../lib/storage.js';
import { apiFetch } from '../lib/api.js';
import { getPublicSessionToken } from '../lib/publicSession.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

function calculateLineTotal(item) {
  const quantity = Number(item.quantity || 0);
  const basePrice = Number(item.discountedPrice || 0);
  const offer = item.acceptedOffer || null;
  const offerQuantity = offer ? Math.min(quantity, Number(offer.quantity || 1)) : 0;
  const offerPrice = offer ? Number(offer.price || 0) : 0;
  return offer ? offerPrice * offerQuantity + basePrice * Math.max(quantity - offerQuantity, 0) : basePrice * quantity;
}
const STORAGE_KEY = 'miami-closet-cart';
const OWNER_STORAGE_KEY = 'miami-closet-cart-owner';

function clampQuantity(quantity, maxQuantity) {
  const safeQuantity = Math.max(1, Number(quantity || 1));
  if (Number.isFinite(maxQuantity) && maxQuantity >= 0) {
    return Math.min(safeQuantity, maxQuantity);
  }
  return safeQuantity;
}


function getLineKey(item) {
  return String(item?.cartLineKey ?? item?.id ?? `${item?.articleId || 'item'}:${item?.acceptedOffer?.id || 'regular'}`);
}

function findLineByKey(items, lineKey) {
  const wanted = String(lineKey);
  return items.find((item) => getLineKey(item) === wanted || String(item.articleId) === wanted) || null;
}

function splitLocalAdd(items, article, quantity, maxQuantity) {
  const requestedQuantity = Math.max(1, Number(quantity || 1));
  const articleId = article.id;
  const existingArticleQuantity = items
    .filter((item) => Number(item.articleId) === Number(articleId))
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const allowedToAdd = Math.max(0, Number(maxQuantity || 0) - existingArticleQuantity);
  const addQuantity = Math.min(requestedQuantity, allowedToAdd);
  const reachedLimit = addQuantity < requestedQuantity;

  if (addQuantity <= 0) {
    return { items, added: 0, reachedLimit: true, quantity: existingArticleQuantity };
  }

  let remaining = addQuantity;
  let nextItems = [...items];
  const acceptedOffer = article.acceptedOffer || null;

  if (acceptedOffer) {
    const offerExists = nextItems.some(
      (item) => Number(item.articleId) === Number(articleId) && Number(item.acceptedOffer?.id) === Number(acceptedOffer.id),
    );

    if (!offerExists && remaining > 0) {
      const offerLine = createLocalCartItem(article, 1, maxQuantity, acceptedOffer);
      nextItems = [...nextItems, offerLine];
      remaining -= 1;
    }
  }

  if (remaining > 0) {
    const regularIndex = nextItems.findIndex(
      (item) => Number(item.articleId) === Number(articleId) && !item.acceptedOffer,
    );

    if (regularIndex >= 0) {
      nextItems = nextItems.map((item, index) => {
        if (index !== regularIndex) return item;
        const nextQuantity = Number(item.quantity || 0) + remaining;
        return { ...item, quantity: nextQuantity, maxQuantity, lineTotal: calculateLineTotal({ ...item, quantity: nextQuantity, maxQuantity }) };
      });
    } else {
      nextItems = [...nextItems, createLocalCartItem(article, remaining, maxQuantity, null)];
    }
  }

  return {
    items: nextItems,
    added: addQuantity,
    reachedLimit,
    quantity: existingArticleQuantity + addQuantity,
  };
}

function createLocalCartItem(article, quantity, maxQuantity, acceptedOffer = null) {
  const item = {
    id: null,
    cartLineKey: `${article.id}:${acceptedOffer?.id || 'regular'}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    articleId: article.id,
    slug: article.slug,
    title: article.title,
    brandName: article.brandName,
    sizeLabel: article.sizeText || article.sizeCode || '',
    image: article.imageThumbUrl || article.imageCardUrl || article.primaryImageThumb || article.primaryImageCard || article.primaryImage || article.images?.[0]?.thumbFilePath || article.images?.[0]?.thumb_file_path || article.images?.[0]?.cardFilePath || article.images?.[0]?.card_file_path || article.images?.[0]?.filePath || article.images?.[0]?.file_path || '',
    salePrice: Number(article.salePrice || 0),
    discountType: article.discountType || 'NONE',
    discountValue: Number(article.discountValue || 0),
    discountedPrice: getDiscountedPrice(article),
    acceptedOffer: acceptedOffer || null,
    quantity,
    maxQuantity,
  };
  item.lineTotal = calculateLineTotal(item);
  return item;
}

function readStoredItems() {
  const stored = storage.get(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function normalizeRemoteItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    cartLineKey: String(item.id ?? `${item.articleId}:${item.acceptedOffer?.id || 'regular'}`),
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
    acceptedOffer: item.acceptedOffer || null,
    lineTotal: Number(item.lineTotal ?? calculateLineTotal(item)),
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

  const refreshCart = useCallback(() => {
    if (!isAuthenticated || !user?.id) return Promise.resolve(null);

    return enqueueSync(async () => {
      const response = await apiFetch('/api/cart');
      const nextItems = normalizeRemoteItems(response.cart?.items || []);
      persist(nextItems, user.id);
      return nextItems;
    });
  }, [isAuthenticated, user?.id]);

  const flushCartSync = useCallback(() => syncQueueRef.current.catch(() => undefined), []);

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
      refreshCart,
      flushCartSync,
      addItem(article, quantity = 1, options = {}) {
        const maxQuantity = Math.max(0, Number(article.quantityAvailable ?? article.maxQuantity ?? 0));
        const existingArticleQuantity = items
          .filter((item) => Number(item.articleId) === Number(article.id))
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

        if (maxQuantity <= 0) {
          return { ok: false, code: 'OUT_OF_STOCK', maxQuantity: 0, quantity: existingArticleQuantity };
        }

        const splitResult = splitLocalAdd(items, article, quantity, maxQuantity);

        if (splitResult.added <= 0) {
          return {
            ok: false,
            code: 'LIMITED',
            maxQuantity,
            quantity: splitResult.quantity,
          };
        }

        setCartFx({
          tick: Date.now(),
          articleId: article.id,
          title: article.title,
          sourceRect: options.sourceRect || null,
        });

        persist(splitResult.items, isAuthenticated ? user?.id || cartOwnerId : null);

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
          ok: !splitResult.reachedLimit,
          code: splitResult.reachedLimit ? 'LIMITED' : splitResult.added > 0 ? 'ADDED' : 'UPDATED',
          maxQuantity,
          quantity: splitResult.quantity,
        };
      },
      removeItem(lineKey) {
        const target = findLineByKey(items, lineKey);
        if (!target) return;

        const nextItems = items.filter((item) => getLineKey(item) !== getLineKey(target));
        persist(nextItems, isAuthenticated ? user?.id || cartOwnerId : null);

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const snapshot = await apiFetch('/api/cart');
            const remoteItem = (snapshot.cart?.items || []).find((item) => getLineKey(item) === getLineKey(target) || Number(item.id) === Number(target.id));

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
      updateQuantity(lineKey, quantity) {
        const existing = findLineByKey(items, lineKey);
        if (!existing) {
          return { ok: false, code: 'NOT_FOUND', quantity: 0, maxQuantity: 0 };
        }

        const articleQuantityWithoutLine = items
          .filter((item) => Number(item.articleId) === Number(existing.articleId) && getLineKey(item) !== getLineKey(existing))
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const maxQuantity = Math.max(1, Number(existing.maxQuantity || existing.quantity || 1));
        const desiredQuantity = Math.max(1, Number(quantity || 1));
        const allowedForLine = Math.max(1, maxQuantity - articleQuantityWithoutLine);
        const nextQuantity = clampQuantity(desiredQuantity, allowedForLine);
        const limited = nextQuantity < desiredQuantity;

        let nextItems = items.map((item) => (
          getLineKey(item) === getLineKey(existing)
            ? { ...item, quantity: existing.acceptedOffer ? 1 : nextQuantity, maxQuantity, lineTotal: calculateLineTotal({ ...item, quantity: existing.acceptedOffer ? 1 : nextQuantity, maxQuantity }) }
            : item
        ));

        if (existing.acceptedOffer && nextQuantity > 1) {
          const extraQuantity = nextQuantity - 1;
          const regularIndex = nextItems.findIndex((item) => Number(item.articleId) === Number(existing.articleId) && !item.acceptedOffer);
          if (regularIndex >= 0) {
            nextItems = nextItems.map((item, index) => {
              if (index !== regularIndex) return item;
              const regularQuantity = Number(item.quantity || 0) + extraQuantity;
              return { ...item, quantity: regularQuantity, maxQuantity, lineTotal: calculateLineTotal({ ...item, quantity: regularQuantity, maxQuantity }) };
            });
          } else {
            nextItems = [...nextItems, {
              ...existing,
              id: null,
              cartLineKey: `${existing.articleId}:regular:${Date.now()}:${Math.random().toString(16).slice(2)}`,
              acceptedOffer: null,
              quantity: extraQuantity,
              discountedPrice: Number(existing.discountedPrice || existing.salePrice || 0),
              lineTotal: Number(existing.discountedPrice || existing.salePrice || 0) * extraQuantity,
            }];
          }
        }

        persist(nextItems, isAuthenticated ? user?.id || cartOwnerId : null);

        if (isAuthenticated) {
          void enqueueSync(async () => {
            const snapshot = await apiFetch('/api/cart');
            const remoteItem = (snapshot.cart?.items || []).find((item) => Number(item.id) === Number(existing.id));

            if (!remoteItem) {
              const added = await apiFetch('/api/cart/items', {
                method: 'POST',
                body: { articleId: existing.articleId, quantity: nextQuantity },
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
        return items.find((item) => Number(item.articleId) === Number(articleId)) || null;
      },
      getItems(articleId) {
        return items.filter((item) => Number(item.articleId) === Number(articleId));
      },
      cartCount: items.reduce((sum, item) => sum + item.quantity, 0),
      cartFx,
      subtotal: items.reduce((sum, item) => sum + Number(item.lineTotal ?? calculateLineTotal(item)), 0),
    }),
    [cartFx, cartOwnerId, flushCartSync, isAuthenticated, items, refreshCart, user?.id],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
