// Schema history. Each entry upgrades the database by one version (tracked in
// PRAGMA user_version). Never edit an entry that has already run on a phone;
// add a new one instead.
export const MIGRATIONS = [
  // v1: initial schema
  `
  CREATE TABLE vehicle (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    colour          TEXT,
    is_default      INTEGER NOT NULL DEFAULT 0,
    archived        INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
  );

  CREATE TABLE place (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    note            TEXT,
    lat             REAL,
    lng             REAL,
    last_used_at    INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
  );

  CREATE UNIQUE INDEX place_name_unique
    ON place (name COLLATE NOCASE) WHERE deleted_at IS NULL;

  CREATE TABLE place_rate (
    id              TEXT PRIMARY KEY,
    place_id        TEXT NOT NULL REFERENCES place(id),
    day_type        TEXT NOT NULL CHECK (day_type IN ('weekday','weekend','holiday')),
    type            TEXT NOT NULL CHECK (type IN ('hourly','flat')),
    first_minutes   INTEGER,
    first_sen       INTEGER,
    block_minutes   INTEGER,
    block_sen       INTEGER,
    grace_minutes   INTEGER NOT NULL DEFAULT 0,
    daily_cap_sen   INTEGER,
    flat_sen        INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    CHECK (day_type <> 'holiday' OR type = 'flat')
  );

  CREATE UNIQUE INDEX place_rate_unique
    ON place_rate (place_id, day_type) WHERE deleted_at IS NULL;

  CREATE TABLE public_holiday (
    id              TEXT PRIMARY KEY,
    holiday_date    TEXT NOT NULL,
    name            TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
  );

  CREATE UNIQUE INDEX public_holiday_unique
    ON public_holiday (holiday_date) WHERE deleted_at IS NULL;

  CREATE TABLE parking_session (
    id               TEXT PRIMARY KEY,
    vehicle_id       TEXT NOT NULL REFERENCES vehicle(id),
    place_id         TEXT REFERENCES place(id),
    status           TEXT NOT NULL CHECK (status IN ('active','ended')),
    started_at       INTEGER NOT NULL,
    ended_at         INTEGER,
    level            TEXT,
    bay              TEXT,
    zone_colour_name TEXT,
    zone_colour_hex  TEXT,
    access_type      TEXT CHECK (access_type IN ('lift','escalator','stairs','other')),
    landmark         TEXT,
    note             TEXT,
    rate_snapshot    TEXT,
    timer_ends_at    INTEGER,
    fee_sen          INTEGER,
    paid_sen         INTEGER,
    lat              REAL,
    lng              REAL,
    gps_accuracy_m   REAL,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    deleted_at       INTEGER
  );

  CREATE UNIQUE INDEX one_active_session_per_vehicle
    ON parking_session (vehicle_id) WHERE status = 'active' AND deleted_at IS NULL;

  -- Local only, never synced. Rows and image files are deleted for real.
  CREATE TABLE photo (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES parking_session(id),
    file_uri        TEXT NOT NULL,
    ocr_text        TEXT,
    created_at      INTEGER NOT NULL
  );

  -- Local only: preferences for this phone.
  CREATE TABLE setting (
    key             TEXT PRIMARY KEY,
    value           TEXT
  );
  `,

  // v2: the car park list (M11). Local only, never synced: reference data
  // shipped inside the app (src/carparks/carParkList.js) and replaced whenever
  // the list's version changes, so its rows are deleted for real. Rates have
  // the place_rate columns, so the fee code reads them the same way.
  `
  CREATE TABLE car_park (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    area            TEXT,
    lat             REAL,
    lng             REAL,
    source_url      TEXT NOT NULL,
    checked_on      TEXT NOT NULL,
    effective_from  TEXT,
    notes           TEXT
  );

  CREATE TABLE car_park_rate (
    car_park_id     TEXT NOT NULL REFERENCES car_park(id) ON DELETE CASCADE,
    day_type        TEXT NOT NULL CHECK (day_type IN ('weekday','weekend','holiday')),
    type            TEXT NOT NULL CHECK (type IN ('hourly','flat')),
    first_minutes   INTEGER,
    first_sen       INTEGER,
    block_minutes   INTEGER,
    block_sen       INTEGER,
    grace_minutes   INTEGER NOT NULL DEFAULT 0,
    daily_cap_sen   INTEGER,
    flat_sen        INTEGER,
    PRIMARY KEY (car_park_id, day_type),
    CHECK (day_type <> 'holiday' OR type = 'flat')
  );
  `,

  // v3: rate history for the car park list (M12). Each rate keeps the date it
  // took effect (null: since before it was first checked) beside the others.
  // The tables hold only a copy of the list, so they are emptied and the list
  // is loaded again when the app starts (the stored stamp is cleared).
  `
  DROP TABLE car_park_rate;
  DELETE FROM car_park;
  ALTER TABLE car_park DROP COLUMN effective_from;
  DELETE FROM setting WHERE key = 'car_park_list_version';

  CREATE TABLE car_park_rate (
    car_park_id     TEXT NOT NULL REFERENCES car_park(id) ON DELETE CASCADE,
    day_type        TEXT NOT NULL CHECK (day_type IN ('weekday','weekend','holiday')),
    effective_from  TEXT,
    type            TEXT NOT NULL CHECK (type IN ('hourly','flat')),
    first_minutes   INTEGER,
    first_sen       INTEGER,
    block_minutes   INTEGER,
    block_sen       INTEGER,
    grace_minutes   INTEGER NOT NULL DEFAULT 0,
    daily_cap_sen   INTEGER,
    flat_sen        INTEGER,
    CHECK (day_type <> 'holiday' OR type = 'flat')
  );

  CREATE UNIQUE INDEX car_park_rate_unique
    ON car_park_rate (car_park_id, day_type, COALESCE(effective_from, ''));
  `,

  // v4: rate reports waiting for review (C10). Local only, never synced: what
  // users reported about listed car parks, a copy of the daily download,
  // replaced whole each time, so its rows are deleted for real. rates is JSON,
  // { weekday, weekend, holiday }, each a place_rate-shaped rate or null.
  `
  CREATE TABLE car_park_report (
    id              TEXT PRIMARY KEY,
    car_park_id     TEXT NOT NULL REFERENCES car_park(id) ON DELETE CASCADE,
    rates           TEXT NOT NULL,
    reported_at     INTEGER NOT NULL
  );

  CREATE INDEX car_park_report_car_park ON car_park_report (car_park_id, reported_at);
  `,

  // v5: change tracking for the sync (C3; PLAN.md, "How the sync works",
  // step 1). dirty is 1 until a row's latest change has reached the server, so
  // every row already on the phone is pushed at the first sync. Local only:
  // the server has no dirty column.
  `
  ALTER TABLE vehicle ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE place ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE place_rate ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public_holiday ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE parking_session ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  `,

  // v6: the sync's pull (C4; PLAN.md, "How the sync works", step 8).
  // merged_into syncs: a place or car merged into another by the sync is
  // soft-deleted and names the one it became, so every phone moves its rates
  // and sessions there. No REFERENCES: the row it names can arrive later in
  // the same pull. parked_here is local only, like dirty: 1 on the phone that
  // parked, which alone shows the session's notifications (a pulled session
  // gets 0). Every session already on the phone was parked here.
  `
  ALTER TABLE place ADD COLUMN merged_into TEXT;
  ALTER TABLE vehicle ADD COLUMN merged_into TEXT;
  ALTER TABLE parking_session ADD COLUMN parked_here INTEGER NOT NULL DEFAULT 1;
  `,
];
