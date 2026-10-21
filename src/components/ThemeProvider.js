import { DarkTheme, DefaultTheme } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { settings, useDatabase } from '../db';
import { DEFAULT_THEME_MODE, palettes, themeModeFrom } from './theme';

const THEME_SETTING = 'theme';

const ThemeContext = createContext(null);

// Loads the saved dark/light choice before showing the app, so a light-mode
// user never sees a dark flash. Must sit inside DatabaseProvider.
// If the choice cannot be read, the app still opens in dark mode and Settings
// shows loadError: a display preference should never stop the app.
export function AppThemeProvider({ children }) {
  const db = useDatabase();
  const [mode, setModeState] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    settings.get(db, THEME_SETTING).then(
      (value) => !cancelled && setModeState(themeModeFrom(value)),
      (e) => {
        if (cancelled) return;
        setLoadError(e);
        setModeState(DEFAULT_THEME_MODE);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Switches at once; puts the old mode back if saving fails, and rethrows so
  // the screen can show the error.
  const setMode = useCallback(
    async (next) => {
      const previous = mode;
      setModeState(next);
      try {
        await settings.set(db, THEME_SETTING, next);
        setLoadError(null);
      } catch (e) {
        setModeState(previous);
        throw e;
      }
    },
    [db, mode]
  );

  const value = useMemo(
    () => (mode ? { mode, colours: palettes[mode], setMode, loadError } : null),
    [mode, setMode, loadError]
  );

  if (!value) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// { mode, colours, setMode, loadError }
export function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return theme;
}

// Builds a screen's styles from the active colours. Pass a function defined
// outside the component so the styles are rebuilt only when the mode changes.
export function useThemedStyles(createStyles) {
  const { colours } = useAppTheme();
  return useMemo(() => createStyles(colours), [createStyles, colours]);
}

// Colours for the headers and tab bar that expo-router draws.
export function navigationThemeFor(mode, colours) {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colours.accent,
      background: colours.background,
      card: colours.card,
      text: colours.text,
      border: colours.border,
      notification: colours.danger,
    },
  };
}
