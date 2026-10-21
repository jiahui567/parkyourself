import { navigationThemeFor } from './ThemeProvider';
import { palettes } from './theme';

describe('navigationThemeFor', () => {
  it.each(['dark', 'light'])('gives the %s headers and tab bar the app colours', (mode) => {
    const colours = palettes[mode];
    const theme = navigationThemeFor(mode, colours);

    expect(theme.dark).toBe(mode === 'dark');
    expect(theme.colors).toEqual({
      primary: colours.accent,
      background: colours.background,
      card: colours.card,
      text: colours.text,
      border: colours.border,
      notification: colours.danger,
    });
    // Fonts come from the navigation library's own theme.
    expect(theme.fonts).toBeDefined();
  });
});
