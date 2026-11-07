import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeContextValue = { theme: Theme; toggleTheme: () => void };
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('Thiếu ThemeProvider.');
  return value;
}
