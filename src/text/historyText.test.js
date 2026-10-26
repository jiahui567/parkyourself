import { NO_PLACE } from '../spending/historyFilter';
import { filterChoiceText, filterPillLabel, filterPillText, filterSheetOptions, filterTitleText } from './historyText';

const MYVI = { value: 'myvi', name: 'My Myvi', sessions: 3 };
const NO_PLACE_CHOICE = { value: NO_PLACE, name: null, sessions: 1 };
const OCTOBER = { value: '2026-10', name: null, sessions: 2 };

describe('filterChoiceText', () => {
  it('names a car or place by its name', () => {
    expect(filterChoiceText('vehicle', MYVI)).toBe('My Myvi');
  });

  it('calls the sessions with no place "No place"', () => {
    expect(filterChoiceText('place', NO_PLACE_CHOICE)).toBe('No place');
  });

  it('names a month', () => {
    expect(filterChoiceText('month', OCTOBER)).toBe('Oct 2026');
  });
});

describe('filterPillText', () => {
  it.each([
    ['vehicle', 'All cars'],
    ['place', 'All places'],
    ['month', 'All months'],
  ])('says all for a %s filter with no choice', (kind, text) => {
    expect(filterPillText(kind, null)).toBe(text);
  });

  it('shows the choice made', () => {
    expect(filterPillText('place', NO_PLACE_CHOICE)).toBe('No place');
  });
});

describe('filterPillLabel', () => {
  it('says which filter it is', () => {
    expect(filterPillLabel('place', null)).toBe('Place: All places');
    expect(filterPillLabel('vehicle', MYVI)).toBe('Car: My Myvi');
  });
});

describe('filterTitleText', () => {
  it('names the filter', () => {
    expect(filterTitleText('month')).toBe('Month');
  });
});

describe('filterSheetOptions', () => {
  it('lists all first, then each choice, with counts and what a screen reader says', () => {
    const options = [OCTOBER, { ...OCTOBER, value: '2026-09', sessions: 1 }];

    expect(filterSheetOptions('month', { all: 3, options })).toEqual([
      { value: null, label: 'All months', countText: '3', accessibilityLabel: 'All months, 3 sessions' },
      { value: '2026-10', label: 'Oct 2026', countText: '2', accessibilityLabel: 'Oct 2026, 2 sessions' },
      { value: '2026-09', label: 'Sep 2026', countText: '1', accessibilityLabel: 'Sep 2026, 1 session' },
    ]);
  });
});
