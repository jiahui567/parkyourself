import { DEFAULT_THEME_MODE, THEME_MODES, dimmedOpacity, palettes, themeModeFrom } from './theme';

// WCAG 2 contrast ratio between two '#RRGGBB' colours.
function contrast(a, b) {
  const luminance = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
      const s = channel / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// colour drawn at opacity over under, as '#RRGGBB'.
function blend(colour, opacity, under) {
  const channels = (hex) => [16, 8, 0].map((shift) => (parseInt(hex.slice(1), 16) >> shift) & 255);
  const [top, bottom] = [channels(colour), channels(under)];
  const mixed = top.map((channel, i) => Math.round(channel * opacity + bottom[i] * (1 - opacity)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const keysOf = (object) =>
  Object.entries(object)
    .flatMap(([key, value]) => (typeof value === 'object' ? keysOf(value).map((k) => `${key}.${k}`) : [key]))
    .sort();

describe('themeModeFrom', () => {
  it('reads a saved mode', () => {
    expect(themeModeFrom('light')).toBe('light');
    expect(themeModeFrom('dark')).toBe('dark');
  });

  it('falls back to dark when nothing or something unknown is saved', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark');
    expect(themeModeFrom(null)).toBe('dark');
    expect(themeModeFrom('blue')).toBe('dark');
  });
});

describe('palettes', () => {
  it('has a colour set for every mode, all with the same tokens', () => {
    expect(Object.keys(palettes).sort()).toEqual([...THEME_MODES].sort());
    expect(keysOf(palettes.light)).toEqual(keysOf(palettes.dark));
  });

  // [foreground, background, minimum ratio]. 4.5 is WCAG AA for body text.
  const PAIRS = [
    ['text', 'background', 7],
    ['text', 'card', 7],
    ['text', 'surface', 7],
    ['muted', 'background', 4.5],
    ['muted', 'card', 4.5],
    ['muted', 'surface', 4.5],
    ['accent', 'background', 4.5],
    ['accent', 'card', 4.5],
    ['accent', 'accentSoft', 4.5],
    ['onPrimary', 'primary', 4.5],
    ['danger', 'background', 4.5],
    ['danger', 'card', 4.5],
    ['warning', 'background', 4.5],
    ['warning', 'card', 4.5],
    ['warning', 'warningSoft', 4.5],
    ['onBackdrop', 'backdrop', 7],
  ];

  describe.each(THEME_MODES)('%s mode', (mode) => {
    it.each(PAIRS)('%s on %s is readable', (foreground, background, minimum) => {
      const colours = palettes[mode];
      expect(contrast(colours[foreground], colours[background])).toBeGreaterThanOrEqual(minimum);
    });

    // A dimmed card (the car park list on Places) fades its rows' text along
    // with the card, over the screen's background. The rows are body text, so 7.
    it('keeps text on a dimmed card readable', () => {
      const { text, card, background } = palettes[mode];
      const fadedText = blend(text, dimmedOpacity, background);
      const fadedCard = blend(card, dimmedOpacity, background);
      expect(contrast(fadedText, fadedCard)).toBeGreaterThanOrEqual(7);
    });
  });
});
