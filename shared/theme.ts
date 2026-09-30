export interface ThemeColors {
  titlebar: string
  symbol: string
  background: string
}

// Kept in sync with the CSS surfaces in renderer/src/styles.css.
export const THEME_COLORS: Record<'light' | 'dark', ThemeColors> = {
  light: { titlebar: '#f5f6fa', symbol: '#3f4553', background: '#f2f3f8' },
  dark: { titlebar: '#171921', symbol: '#d9dde8', background: '#121419' },
}
