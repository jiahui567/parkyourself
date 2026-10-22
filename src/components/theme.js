// Colour sets for dark mode (the default) and light mode. Both sets have the
// same keys, so a screen can use any token in either mode. Screens get the
// active set from useAppTheme() or useThemedStyles() in ThemeProvider.js and
// never write a hex themselves.
//
// Emerald (primary, accent) is kept for the main action and positive states
// such as "Parked"; everything else is neutral charcoal and white.

export const THEME_MODES = ['dark', 'light'];
export const DEFAULT_THEME_MODE = 'dark';

export const palettes = {
  dark: {
    background: '#0E1013',
    card: '#171A1F',
    surface: '#1F2329', // inputs, chips, segmented controls
    text: '#F2F4F5',
    muted: '#8B929A',
    border: '#2A2F36',
    primary: '#10B981', // emerald fill for the main action
    onPrimary: '#03140D', // text and icons on primary
    accent: '#34D399', // emerald text, icons and selected states
    accentSoft: '#123528', // background behind accent text
    danger: '#F87171',
    warning: '#FBBF24', // amber text: "Estimate", "Overnight: check your receipt"
    warningSoft: '#3A2A0A', // background behind warning text
    // A 1 px ring instead of a shadow: shadows do not show on a dark background.
    shadow: '0 0 0 1px rgba(255, 255, 255, 0.06)',
    primaryGlow: '0 6px 24px rgba(16, 185, 129, 0.35)', // under the round Park button
    statusBar: 'light',
    // Behind the camera and a full-screen photo, the same in both modes.
    backdrop: '#000000',
    onBackdrop: '#FFFFFF',
    backdropSoft: 'rgba(0, 0, 0, 0.45)', // round buttons over the camera preview
    car: {
      bodyTop: '#454C55',
      bodyBottom: '#1C2026',
      edge: '#4F5761',
      glass: '#0B0F13',
      tyre: '#050607',
      rim: '#5B636D',
      hub: '#2A2F36',
      shadow: '#000000',
      tailLight: '#EF4444',
    },
  },
  light: {
    background: '#F5F6F8',
    card: '#FFFFFF',
    surface: '#EEF0F3',
    text: '#1F2328',
    muted: '#5F6670',
    border: '#DDE1E6',
    primary: '#10B981',
    onPrimary: '#03140D',
    accent: '#047857',
    accentSoft: '#D1FAE5',
    danger: '#C62828',
    warning: '#A14A07',
    warningSoft: '#FEF3C7',
    shadow: '0 2px 12px rgba(31, 35, 40, 0.08)',
    primaryGlow: '0 6px 20px rgba(16, 185, 129, 0.4)',
    statusBar: 'dark',
    backdrop: '#000000',
    onBackdrop: '#FFFFFF',
    backdropSoft: 'rgba(0, 0, 0, 0.45)',
    car: {
      bodyTop: '#FFFFFF',
      bodyBottom: '#D5DAE0',
      edge: '#BFC6CE',
      glass: '#2B3138',
      tyre: '#1F2328',
      rim: '#9AA3AD',
      hub: '#5B636D',
      shadow: '#1F2328',
      tailLight: '#EF4444',
    },
  },
};

export const space = 12;

export const radius = { card: 16, control: 12, pill: 999 };

// The saved setting text to a mode; anything unknown falls back to dark.
export function themeModeFrom(value) {
  return THEME_MODES.includes(value) ? value : DEFAULT_THEME_MODE;
}
