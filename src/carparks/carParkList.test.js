import { assertCarParkList } from '../db/carParks';
import { calcDayFeeSen } from '../fees/calcFee';
import { CAR_PARK_LIST } from './carParkList';

const listed = CAR_PARK_LIST.carParks;
const rateRows = listed.flatMap((c) => c.rates.map((rate) => [`${c.name}, ${rate.day_type}`, rate]));

describe('the built-in car park list', () => {
  it('can be stored as it is', () => {
    expect(() => assertCarParkList(CAR_PARK_LIST)).not.toThrow();
  });

  it.each(listed.map((c) => [c.name, c]))('%s is in the Klang Valley, if located', (_, carPark) => {
    if (carPark.lat == null) return;
    expect(carPark.lat).toBeGreaterThan(2.7);
    expect(carPark.lat).toBeLessThan(3.4);
    expect(carPark.lng).toBeGreaterThan(101.3);
    expect(carPark.lng).toBeLessThan(101.9);
  });

  it.each(rateRows)('%s prices a 2-hour stay sensibly', (_, rate) => {
    const fee = calcDayFeeSen(2 * 60 * 60 * 1000, rate);
    expect(fee).toBeGreaterThanOrEqual(0);
    expect(fee).toBeLessThanOrEqual(5000);
  });
});
