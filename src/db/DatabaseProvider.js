import { SQLiteProvider } from 'expo-sqlite';

import { CAR_PARK_LIST } from '../carparks/carParkList';
import { carParks } from './carParks';
import { migrate } from './migrate';

// Stored at files/SQLite/park-yourself.db inside the app's private storage.
export const DATABASE_NAME = 'park-yourself.db';

// Brings the schema up to date, then the built-in car park list (only when
// this app version ships a new one; a failure there never stops the app).
async function prepare(db) {
  await migrate(db);
  await carParks.refreshAtStart(db, CAR_PARK_LIST);
}

export function DatabaseProvider({ children }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={prepare}>
      {children}
    </SQLiteProvider>
  );
}
