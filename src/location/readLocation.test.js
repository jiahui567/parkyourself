import * as Location from 'expo-location';

import { lookUpPlaceName } from './readLocation';

// expo-location is native: only what this module adds to it is tested here.
jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn() }));

const READING = { lat: 3.0733, lng: 101.6073, accuracyM: 12 };

afterEach(() => {
  jest.useRealTimers();
});

describe('lookUpPlaceName', () => {
  it('names the place from the first address found', async () => {
    Location.reverseGeocodeAsync.mockResolvedValue([{ name: 'Sunway Pyramid', streetNumber: null }]);

    expect(await lookUpPlaceName(READING)).toBe('Sunway Pyramid');
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: 3.0733, longitude: 101.6073 });
  });

  it('gives up when the geocoder never answers, so Park can say so and try again', async () => {
    jest.useFakeTimers();
    // expo-location on Android 13 and later, when the geocoder fails.
    Location.reverseGeocodeAsync.mockReturnValue(new Promise(() => {}));

    const lookup = expect(lookUpPlaceName(READING)).rejects.toThrow('the lookup took too long');
    await jest.advanceTimersByTimeAsync(10 * 1000);
    await lookup;
  });
});
