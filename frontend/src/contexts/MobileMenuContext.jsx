import { createContext, useContext, useMemo, useState } from 'react';

const MobileMenuContext = createContext({
  catalogFiltersContent: null,
  catalogSortContent: null,
  catalogFiltersCount: 0,
  catalogSortActive: false,
  clearCatalogFilters: null,
  clearCatalogSort: null,
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

  const value = useMemo(
    () => ({
      catalogFiltersContent,
      catalogSortContent,
      catalogFiltersCount: Number(catalogFiltersMeta.count || 0),
      catalogSortActive: Boolean(catalogSortMeta.active),
      clearCatalogFilters: catalogFiltersMeta.onClear,
      clearCatalogSort: catalogSortMeta.onClear,
      setCatalogFiltersContent,
      setCatalogSortContent,
      setCatalogFiltersMeta,
      setCatalogSortMeta,
    }),
    [catalogFiltersContent, catalogSortContent, catalogFiltersMeta, catalogSortMeta],
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
