import { SQLiteProvider } from 'expo-sqlite';

import { migrate } from './migrate';

// Stored at files/SQLite/park-yourself.db inside the app's private storage.
export const DATABASE_NAME = 'park-yourself.db';

export function DatabaseProvider({ children }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      {children}
    </SQLiteProvider>
  );
}
