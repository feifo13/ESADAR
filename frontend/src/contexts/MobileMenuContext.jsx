import { createContext, useContext, useMemo, useState } from 'react';

const MobileMenuContext = createContext({
  catalogFiltersContent: null,
  catalogFiltersCount: 0,
  clearCatalogFilters: null,
  setCatalogFiltersContent: () => undefined,
  setCatalogFiltersMeta: () => undefined,
});

export function MobileMenuProvider({ children }) {
  const [catalogFiltersContent, setCatalogFiltersContent] = useState(null);
  const [catalogFiltersMeta, setCatalogFiltersMeta] = useState({
    count: 0,
    onClear: null,
  });

  const value = useMemo(
    () => ({
      catalogFiltersContent,
      catalogFiltersCount: Number(catalogFiltersMeta.count || 0),
      clearCatalogFilters: catalogFiltersMeta.onClear,
      setCatalogFiltersContent,
      setCatalogFiltersMeta,
    }),
    [catalogFiltersContent, catalogFiltersMeta],
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
