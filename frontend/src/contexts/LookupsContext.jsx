import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  BRAND_OPTIONS,
  CATEGORY_OPTIONS,
  SIZE_OPTIONS,
} from '../constants/lookups.js';
import { cachedApiFetch } from '../lib/api.js';

const LookupsContext = createContext(null);

const HIDDEN_PUBLIC_SHIPPING_METHOD_LABELS = new Set([
  'retiro en punto acordado',
]);

function normalizeLookupLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isPublicShippingMethodVisible(option) {
  return !HIDDEN_PUBLIC_SHIPPING_METHOD_LABELS.has(
    normalizeLookupLabel(option?.label || option?.description),
  );
}

const fallbackValue = {
  categoryOptions: CATEGORY_OPTIONS,
  brandOptions: BRAND_OPTIONS,
  catalogBrandOptions: BRAND_OPTIONS,
  sizeOptions: SIZE_OPTIONS,
  shippingMethodOptions: [],
  paymentMethodOptions: [],
  loaded: false,
  lookupError: '',
};

function mapCategoryOptions(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.name,
    slug: item.slug,
    description: item.description || '',
  }));
}

function mapBrandOptions(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.name,
    slug: item.slug,
  }));
}

function mapSizeOptions(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.code,
    description: item.description || '',
  }));
}

function mapShippingMethodOptions(items) {
  return items
    .map((item) => ({
      id: item.id,
      label: item.description,
      cost: Number(item.baseCost || 0),
      instructions: item.instructions || '',
    }))
    .filter(isPublicShippingMethodVisible);
}

function mapPaymentMethodOptions(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    instructions: item.instructions || '',
  }));
}

export function LookupsProvider({ children }) {
  const [value, setValue] = useState(fallbackValue);

  useEffect(() => {
    let ignore = false;

    async function loadLookups() {
      try {
        const response = await cachedApiFetch('/api/public/lookups', { ttlMs: 900000 });
        if (ignore) return;

        setValue({
          categoryOptions: mapCategoryOptions(response.categories || []),
          brandOptions: mapBrandOptions(response.brands || []),
          catalogBrandOptions: mapBrandOptions(response.availableBrands || response.brands || []),
          sizeOptions: mapSizeOptions(response.sizes || []),
          shippingMethodOptions: mapShippingMethodOptions(response.shippingMethods || []),
          paymentMethodOptions: mapPaymentMethodOptions(response.paymentMethods || []),
          loaded: true,
          lookupError: '',
        });
      } catch (_error) {
        if (ignore) return;
        setValue((current) => ({
          ...current,
          loaded: true,
          lookupError: 'No se pudieron actualizar los lookups remotos. Se mantiene el fallback local.',
        }));
      }
    }

    loadLookups();

    return () => {
      ignore = true;
    };
  }, []);

  const memoizedValue = useMemo(() => value, [value]);

  return <LookupsContext.Provider value={memoizedValue}>{children}</LookupsContext.Provider>;
}

export function useLookups() {
  const context = useContext(LookupsContext);
  if (!context) throw new Error('useLookups must be used inside LookupsProvider');
  return context;
}
