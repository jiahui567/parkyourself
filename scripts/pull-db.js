// Copies the app's SQLite database from the USB-connected phone or emulator
// into db-snapshot/, ready to open in DBeaver or DB Browser for SQLite.
// Works only with debug builds (run-as). The -wal file is copied too, so the
// snapshot includes recent writes.
//
// Use this instead of `adb exec-out ... > file` in Windows PowerShell, which
// re-encodes the output and corrupts the database file.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE = 'com.parkyourself.app';
const DB_DIR = 'files/SQLite';
const DB_NAME = 'park-yourself.db';
const OUT_DIR = path.join(__dirname, '..', 'db-snapshot');

const adb = process.env.ANDROID_HOME
  ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
  : 'adb';

function run(args) {
  const result = spawnSync(adb, args, { maxBuffer: 1024 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
}

const listing = run(['shell', 'run-as', PACKAGE, 'ls', DB_DIR]);
if (listing.status !== 0) {
  console.error(listing.stderr.toString() || listing.stdout.toString());
  console.error(`Is the phone connected (adb devices) with a debug build of ${PACKAGE}?`);
  process.exit(1);
}
const present = listing.stdout.toString().split(/\s+/);
if (!present.includes(DB_NAME)) {
  console.error(`${DB_DIR}/${DB_NAME} not found. Open the app once to create it.`);
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const name of [DB_NAME, `${DB_NAME}-wal`, `${DB_NAME}-shm`]) {
  if (!present.includes(name)) continue;
  const { stdout } = run(['exec-out', 'run-as', PACKAGE, 'cat', `${DB_DIR}/${name}`]);
  fs.writeFileSync(path.join(OUT_DIR, name), stdout);
  console.log(`${name}: ${stdout.length} bytes`);
}
console.log(`Open ${path.join(OUT_DIR, DB_NAME)} in DBeaver or DB Browser for SQLite.`);
