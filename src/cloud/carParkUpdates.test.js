import { openMigratedTestDatabase } from '../../test/testDatabase';
import { CAR_PARK_LIST } from '../carparks/carParkList';
import { carParks } from '../db';
import { updateCarParkListIfDue } from './carParkUpdates';
import { downloadCarParkList } from './supabase';

// No network in Jest: the download is replaced, and the server is "set up".
jest.mock('./supabase', () => ({ supabaseUrl: 'https://example.supabase.co', downloadCarParkList: jest.fn() }));

const NOW = new Date('2026-10-24T09:00').getTime();
const HOUR = 60 * 60 * 1000;
const SERVER_LIST = { version: 'server', carParks: CAR_PARK_LIST.carParks.slice(0, 2) };

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  downloadCarParkList.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  db.close();
  console.warn.mockRestore();
});

describe('updateCarParkListIfDue', () => {
  it('downloads the list and stores it', async () => {
    downloadCarParkList.mockResolvedValue(SERVER_LIST);

    expect(await updateCarParkListIfDue(db, NOW)).toBe('updated');
    expect(await carParks.info(db)).toMatchObject({ source: 'server', carParks: 2, error: null });
  });

  it('downloads at most once a day', async () => {
    downloadCarParkList.mockResolvedValue(SERVER_LIST);
    await updateCarParkListIfDue(db, NOW);

    expect(await updateCarParkListIfDue(db, NOW + 23 * HOUR)).toBe('not due');
    expect(await updateCarParkListIfDue(db, NOW + 24 * HOUR)).toBe('unchanged');
    expect(downloadCarParkList).toHaveBeenCalledTimes(2);
  });

  it('downloads once when two checks start together', async () => {
    downloadCarParkList.mockResolvedValue(SERVER_LIST);

    const results = await Promise.all([updateCarParkListIfDue(db, NOW), updateCarParkListIfDue(db, NOW)]);

    expect(results).toEqual(['updated', 'updated']);
    expect(downloadCarParkList).toHaveBeenCalledTimes(1);
  });

  it('keeps the phone copy and the error when the download fails, and waits a day', async () => {
    await carParks.refresh(db, CAR_PARK_LIST, 'bundled');
    downloadCarParkList.mockRejectedValue(new Error('Network request failed'));

    expect(await updateCarParkListIfDue(db, NOW)).toBe('failed');
    expect(await carParks.info(db)).toMatchObject({
      source: 'bundled',
      carParks: CAR_PARK_LIST.carParks.length,
      error: 'Download: Network request failed',
    });
    expect(await updateCarParkListIfDue(db, NOW + HOUR)).toBe('not due');
  });

  it('refuses a downloaded list that cannot be stored, keeping the phone copy', async () => {
    await carParks.refresh(db, CAR_PARK_LIST, 'bundled');
    downloadCarParkList.mockResolvedValue({ version: 'server', carParks: [{ id: 'x', name: 'X' }] });

    expect(await updateCarParkListIfDue(db, NOW)).toBe('failed');
    expect((await carParks.info(db)).carParks).toBe(CAR_PARK_LIST.carParks.length);
  });
});
