import { createContext, useContext, useMemo, useState } from 'react';

const MobileMenuContext = createContext({
  catalogFiltersContent: null,
  setCatalogFiltersContent: () => undefined,
  catalogSortContent: null,
  setCatalogSortContent: () => undefined,
  activeCatalogFilterCount: 0,
  setActiveCatalogFilterCount: () => undefined,
  clearCatalogFilters: null,
  setClearCatalogFilters: () => undefined,
});

export function MobileMenuProvider({ children }) {
  const [catalogFiltersContent, setCatalogFiltersContent] = useState(null);
  const [catalogSortContent, setCatalogSortContent] = useState(null);
  const [activeCatalogFilterCount, setActiveCatalogFilterCount] = useState(0);
  const [clearCatalogFilters, setClearCatalogFilters] = useState(null);

  const value = useMemo(
    () => ({
      catalogFiltersContent,
      setCatalogFiltersContent,
      catalogSortContent,
      setCatalogSortContent,
      activeCatalogFilterCount,
      setActiveCatalogFilterCount,
      clearCatalogFilters,
      setClearCatalogFilters,
    }),
    [
      activeCatalogFilterCount,
      catalogFiltersContent,
      catalogSortContent,
      clearCatalogFilters,
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
