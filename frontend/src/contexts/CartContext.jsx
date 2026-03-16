import { createContext, useContext, useMemo, useState } from 'react';
import { getDiscountedPrice } from '../lib/format.js';
import { storage } from '../lib/storage.js';

const CartContext = createContext(null);

function clampQuantity(quantity, maxQuantity) {
  const safeQuantity = Math.max(1, Number(quantity || 1));
  if (Number.isFinite(maxQuantity) && maxQuantity >= 0) {
    return Math.min(safeQuantity, maxQuantity);
  }
  return safeQuantity;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => storage.get('miami-closet-cart', []));
  const [cartFx, setCartFx] = useState({ tick: 0, articleId: null, title: '', sourceRect: null });

  function persist(nextItems) {
    setItems(nextItems);
    storage.set('miami-closet-cart', nextItems);
  }

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

        if (existing) {
          persist(
            items.map((item) =>
              item.articleId === article.id
                ? { ...item, quantity: nextQuantity, maxQuantity }
                : item,
            ),
          );

          return {
            ok: !reachedLimit,
            code: reachedLimit ? 'LIMITED' : 'UPDATED',
            maxQuantity,
            quantity: nextQuantity,
          };
        }

        const newItem = {
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

        persist([...items, newItem]);

        return {
          ok: !reachedLimit,
          code: reachedLimit ? 'LIMITED' : 'ADDED',
          maxQuantity,
          quantity: nextQuantity,
        };
      },
      removeItem(articleId) {
        persist(items.filter((item) => item.articleId !== articleId));
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
          items.map((item) =>
            item.articleId === articleId ? { ...item, quantity: nextQuantity, maxQuantity } : item,
          ),
        );

        return {
          ok: !limited,
          code: limited ? 'LIMITED' : 'UPDATED',
          quantity: nextQuantity,
          maxQuantity,
        };
      },
      clearCart() {
        persist([]);
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
    [items, cartFx],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
