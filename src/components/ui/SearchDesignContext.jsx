import React, { createContext, useContext, useState } from 'react';

export const SEARCH_DESIGNS = ['outlined', 'filled', 'compact'];
export const DEFAULT_SEARCH_STYLES = {
  outlined: { height: 40, radius: 10, fontSize: 14, background: '#ffffff', border: '#e5e7eb', accent: '#6366f1' },
  filled: { height: 40, radius: 10, fontSize: 14, background: '#f3f4f6', border: '#f3f4f6', accent: '#6366f1' },
  compact: { height: 34, radius: 7, fontSize: 13, background: '#ffffff', border: '#e5e7eb', accent: '#6366f1' }
};
export const SearchDesignContext = createContext(null);
export function SearchDesignProvider({ storageKey, page, children }) {
  const [config, setConfig] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey));
      return { styles: DEFAULT_SEARCH_STYLES, assignments: saved?.assignments || {} };
    } catch { return { styles: DEFAULT_SEARCH_STYLES, assignments: {} }; }
  });
  const [saveError, setSaveError] = useState('');
  const update = next => {
    setConfig(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(''); }
    catch { setSaveError('Changes are live for this session, but this browser could not save them.'); }
  };
  return <SearchDesignContext.Provider value={{ config, update, page, saveError }}>{children}</SearchDesignContext.Provider>;
}
export const useSearchDesign = () => useContext(SearchDesignContext);
export function searchStyleVariables(style) {
  if (!style) return {};
  return { '--search-height': `${style.height}px`, '--search-radius': `${style.radius}px`,
    '--search-font-size': `${style.fontSize}px`, '--search-background': style.background,
    '--search-border': style.border, '--search-accent': style.accent };
}
