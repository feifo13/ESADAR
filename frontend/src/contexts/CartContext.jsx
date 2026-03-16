import { createContext, useContext, useMemo, useState } from 'react';
import { getDiscountedPrice } from '../lib/format.js';
import { storage } from '../lib/storage.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => storage.get('miami-closet-cart', []));
  const [cartFx, setCartFx] = useState({ tick: 0, articleId: null, title: '' });

  function persist(nextItems) {
    setItems(nextItems);
    storage.set('miami-closet-cart', nextItems);
  }

  const value = useMemo(
    () => ({
      items,
      addItem(article, quantity = 1) {
        setCartFx({ tick: Date.now(), articleId: article.id, title: article.title });
        const existing = items.find((item) => item.articleId === article.id);
        if (existing) {
          persist(
            items.map((item) =>
              item.articleId === article.id
                ? { ...item, quantity: Math.max(1, item.quantity + quantity) }
                : item,
            ),
          );
          return;
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
          quantity,
        };

        persist([...items, newItem]);
      },
      removeItem(articleId) {
        persist(items.filter((item) => item.articleId !== articleId));
      },
      updateQuantity(articleId, quantity) {
        persist(
          items.map((item) =>
            item.articleId === articleId ? { ...item, quantity: Math.max(1, quantity) } : item,
          ),
        );
      },
      clearCart() {
        persist([]);
      },
      isInCart(articleId) {
        return items.some((item) => item.articleId === articleId);
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
