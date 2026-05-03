import { createContext, useContext, useMemo, useState } from 'react';

const MobileMenuContext = createContext({
  catalogFiltersContent: null,
  setCatalogFiltersContent: () => undefined,
});

export function MobileMenuProvider({ children }) {
  const [catalogFiltersContent, setCatalogFiltersContent] = useState(null);

  const value = useMemo(
    () => ({ catalogFiltersContent, setCatalogFiltersContent }),
    [catalogFiltersContent],
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
