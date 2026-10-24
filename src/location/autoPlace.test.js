import { placeForReading, shouldFillPlace } from './autoPlace';

const VELOCITY = { id: 'v', name: 'Sunway Velocity', lat: 3.1279, lng: 101.7238 };
const LISTED_VELOCITY = { id: 'sunway-velocity-mall', name: 'Sunway Velocity Mall', lat: 3.1279, lng: 101.7238 };
// About 100 m north of Sunway Velocity.
const HERE = { lat: 3.1288, lng: 101.7238, accuracyM: 15 };
const FAR = { lat: 3.2, lng: 101.7238, accuracyM: 15 };
const none = async () => [];

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
    const listCarParks = jest.fn(async () => [LISTED_VELOCITY]);

    expect(await placeForReading(HERE, { listSavedPlaces: async () => [VELOCITY], listCarParks, lookUpName })).toEqual({
      id: 'v',
      name: 'Sunway Velocity',
    });
    expect(listCarParks).not.toHaveBeenCalled();
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('suggests a listed car park nearby before looking a name up online', async () => {
    const lookUpName = lookUp('Somewhere else');

    expect(
      await placeForReading(HERE, { listSavedPlaces: none, listCarParks: async () => [LISTED_VELOCITY], lookUpName })
    ).toEqual({ id: null, name: 'Sunway Velocity Mall', carParkId: 'sunway-velocity-mall' });
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('finds a saved place with no location of its own through the list', async () => {
    const lookUpName = lookUp('Somewhere else');
    const listCarParks = async () => [{ ...LISTED_VELOCITY, place_id: 'v2', place_name: 'sunway velocity mall' }];

    expect(await placeForReading(HERE, { listSavedPlaces: none, listCarParks, lookUpName })).toEqual({
      id: 'v2',
      name: 'sunway velocity mall',
    });
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('names a new place online when nothing saved or listed is near', async () => {
    const lookUpName = lookUp('Wangsa Walk Mall');

    const lists = { listSavedPlaces: async () => [VELOCITY], listCarParks: async () => [LISTED_VELOCITY] };

    expect(await placeForReading(FAR, { ...lists, lookUpName })).toEqual({ id: null, name: 'Wangsa Walk Mall' });
    expect(lookUpName).toHaveBeenCalledWith(FAR);
  });

  it('finds nothing when the lookup has no name', async () => {
    const lookUpName = lookUp(null);

    expect(await placeForReading(FAR, { listSavedPlaces: none, listCarParks: none, lookUpName })).toBeNull();
  });

  it('does nothing with a rough reading', async () => {
    const listSavedPlaces = jest.fn(async () => [VELOCITY]);
    const lookUpName = lookUp('Anywhere');

    const rough = { ...HERE, accuracyM: 900 };

    expect(await placeForReading(rough, { listSavedPlaces, listCarParks: none, lookUpName })).toBeNull();
    expect(listSavedPlaces).not.toHaveBeenCalled();
    expect(lookUpName).not.toHaveBeenCalled();
  });

  it('passes a failed lookup on to the caller', async () => {
    const lookUpName = jest.fn(async () => {
      throw new Error('No network');
    });

    await expect(placeForReading(FAR, { listSavedPlaces: none, listCarParks: none, lookUpName })).rejects.toThrow(
      'No network'
    );
  });
});
