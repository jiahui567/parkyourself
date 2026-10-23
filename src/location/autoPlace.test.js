import { placeForReading, shouldFillPlace } from './autoPlace';

const VELOCITY = { id: 'v', name: 'Sunway Velocity', lat: 3.1279, lng: 101.7238 };
// About 100 m north of Sunway Velocity.
const HERE = { lat: 3.1288, lng: 101.7238, accuracyM: 15 };
const FAR = { lat: 3.2, lng: 101.7238, accuracyM: 15 };

describe('shouldFillPlace', () => {
  const ready = { touched: false, filled: false, finding: false, reading: HERE };

  it.each([
    { rule: 'fills once reading has finished', state: ready, fill: true },
    { rule: 'waits while a fresher reading may come', state: { ...ready, finding: true }, fill: false },
    { rule: 'never replaces a place the user picked or typed', state: { ...ready, touched: true }, fill: false },
    { rule: 'fills only once', state: { ...ready, filled: true }, fill: false },
    { rule: 'does not guess from a rough reading', state: { ...ready, reading: { ...HERE, accuracyM: 900 } }, fill: false },
    { rule: 'needs a reading', state: { ...ready, reading: null }, fill: false },
  ])('$rule', ({ state, fill }) => {
    expect(shouldFillPlace(state)).toBe(fill);
  });
});

describe('placeForReading', () => {
  const lookUp = (name) => jest.fn(async () => name);

  it('picks a saved place nearby without looking anything up', async () => {
    const lookUpName = lookUp('Somewhere else');

    expect(await placeForReading(HERE, { listSavedPlaces: async () => [VELOCITY], lookUpName })).toEqual({
      id: 'v',
      name: 'Sunway Velocity',
    });
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('names a new place online when no saved place is near', async () => {
    const lookUpName = lookUp('Wangsa Walk Mall');

    expect(await placeForReading(FAR, { listSavedPlaces: async () => [VELOCITY], lookUpName })).toEqual({
      id: null,
      name: 'Wangsa Walk Mall',
    });
    expect(lookUpName).toHaveBeenCalledWith(FAR);
  });

  it('finds nothing when the lookup has no name', async () => {
    expect(await placeForReading(FAR, { listSavedPlaces: async () => [], lookUpName: lookUp(null) })).toBeNull();
  });

  it('does nothing with a rough reading', async () => {
    const listSavedPlaces = jest.fn(async () => [VELOCITY]);
    const lookUpName = lookUp('Anywhere');

    expect(await placeForReading({ ...HERE, accuracyM: 900 }, { listSavedPlaces, lookUpName })).toBeNull();
    expect(listSavedPlaces).not.toHaveBeenCalled();
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('passes a failed lookup on to the caller', async () => {
    const lookUpName = jest.fn(async () => {
      throw new Error('No network');
    });

    await expect(placeForReading(FAR, { listSavedPlaces: async () => [], lookUpName })).rejects.toThrow('No network');
  });
});
