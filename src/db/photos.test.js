import { openMigratedTestDatabase } from '../../test/testDatabase';
import { photos } from './photos';
import { sessions } from './sessions';
import { vehicles } from './vehicles';

// Only the rows are tested here: copying and deleting the image files needs
// the phone's file system, which src/db/selfTest.js checks.
const PILLAR = 'file:///photos/pillar.jpg';
const LIFT = 'file:///photos/lift.jpg';
const SHOP = 'file:///photos/shop.jpg';

let db;
let myvi;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  myvi = await vehicles.add(db, { name: 'My Myvi' });
  // Deleting the image files cannot work in Jest; the rows are what matter.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  console.warn.mockRestore();
  db.close();
});

const uris = async (sessionId) => (await photos.listForSession(db, sessionId)).map((p) => p.file_uri);

describe('photos saved with a session', () => {
  it('keeps the order they were taken in, the pillar sign first', async () => {
    const id = await sessions.start(db, {
      vehicle_id: myvi,
      photo_files: [{ file_uri: PILLAR }, { file_uri: LIFT }, { file_uri: SHOP }],
    });

    expect(await uris(id)).toEqual([PILLAR, LIFT, SHOP]);
  });

  it('keeps the text OCR read from each photo, and none for a photo not read', async () => {
    const id = await sessions.start(db, {
      vehicle_id: myvi,
      photo_files: [{ file_uri: PILLAR, ocr_text: 'LEVEL B2 ZONE C-14' }, { file_uri: LIFT, ocr_text: null }],
    });

    expect((await photos.listForSession(db, id)).map((p) => p.ocr_text)).toEqual(['LEVEL B2 ZONE C-14', null]);
  });

  it('saves none when parking fails', async () => {
    await sessions.start(db, { vehicle_id: myvi });

    await expect(sessions.start(db, { vehicle_id: myvi, photo_files: [{ file_uri: PILLAR }] })).rejects.toThrow('already parked');
    expect((await db.getFirstAsync('SELECT COUNT(*) AS n FROM photo')).n).toBe(0);
  });

  it('puts a photo added while parked after the ones taken at Park', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, photo_files: [{ file_uri: PILLAR }] });

    await photos.add(db, { session_id: id, file_uri: LIFT });

    expect(await uris(id)).toEqual([PILLAR, LIFT]);
  });
});

describe('deleting photos', () => {
  it('removes one photo and keeps the others', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, photo_files: [{ file_uri: PILLAR }, { file_uri: LIFT }] });
    const [pillar] = await photos.listForSession(db, id);

    expect(await photos.remove(db, pillar.id)).toBe(1);
    expect(await uris(id)).toEqual([LIFT]);
  });

  it('reports a photo that is already gone', async () => {
    expect(await photos.remove(db, 'missing')).toBe(0);
  });

  it('deletes every photo row when the session is deleted', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, photo_files: [{ file_uri: PILLAR }, { file_uri: LIFT }] });

    await sessions.remove(db, id);

    expect(await uris(id)).toEqual([]);
  });
});
