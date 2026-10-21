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
];
