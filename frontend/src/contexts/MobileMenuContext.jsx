import { createContext, useContext, useCallback, useMemo, useState } from 'react';

const MobileMenuContext = createContext({
  catalogFiltersContent: null,
  catalogSortContent: null,
  catalogFiltersCount: 0,
  catalogSortActive: false,
  clearCatalogFilters: null,
  clearCatalogSort: null,
  mobileStatusBand: null,
  notifyMobileStatus: () => undefined,
  setCatalogFiltersContent: () => undefined,
  setCatalogSortContent: () => undefined,
  setCatalogFiltersMeta: () => undefined,
  setCatalogSortMeta: () => undefined,
});

export function MobileMenuProvider({ children }) {
  const [catalogFiltersContent, setCatalogFiltersContent] = useState(null);
  const [catalogSortContent, setCatalogSortContent] = useState(null);
  const [catalogFiltersMeta, setCatalogFiltersMeta] = useState({
    count: 0,
    onClear: null,
  });
  const [catalogSortMeta, setCatalogSortMeta] = useState({
    active: false,
    onClear: null,
  });
  const [mobileStatusBand, setMobileStatusBand] = useState(null);

  const notifyMobileStatus = useCallback((next) => {
    const payload = typeof next === 'string' ? { message: next } : next || {};
    if (!payload.message) {
      setMobileStatusBand(null);
      return;
    }
    setMobileStatusBand({
      id: Date.now(),
      type: payload.type || 'info',
      icon: payload.icon || payload.type || 'info',
      message: payload.message,
      duration: Number(payload.duration || 3000),
    });
  }, []);

  const value = useMemo(
    () => ({
      catalogFiltersContent,
      catalogSortContent,
      catalogFiltersCount: Number(catalogFiltersMeta.count || 0),
      catalogSortActive: Boolean(catalogSortMeta.active),
      clearCatalogFilters: catalogFiltersMeta.onClear,
      clearCatalogSort: catalogSortMeta.onClear,
      mobileStatusBand,
      notifyMobileStatus,
      setCatalogFiltersContent,
      setCatalogSortContent,
      setCatalogFiltersMeta,
      setCatalogSortMeta,
    }),
    [
      catalogFiltersContent,
      catalogSortContent,
      catalogFiltersMeta,
      catalogSortMeta,
      mobileStatusBand,
      notifyMobileStatus,
    ],
  );

  return (
    <MobileMenuContext.Provider value={value}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}
