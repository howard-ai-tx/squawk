-- Squawk D1 schema

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT,
  password_salt  TEXT,
  role           TEXT NOT NULL, -- 'admin' | 'bt'
  otp            TEXT,
  otp_used       INTEGER NOT NULL DEFAULT 0,
  avatar_data_url TEXT,
  settings_json  TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL,
  created_by     TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  model         TEXT NOT NULL,
  date_added    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id                   TEXT PRIMARY KEY,
  bt_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT,
  category             TEXT,
  subcategory          TEXT,
  description          TEXT,
  device_id            TEXT,
  model                TEXT,
  event_timestamp      TEXT,
  timestamp_precision  TEXT,
  attachment_json      TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id                   TEXT PRIMARY KEY,
  bt_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT,
  category             TEXT NOT NULL,
  subcategory          TEXT NOT NULL,
  description          TEXT NOT NULL,
  device_id            TEXT,
  model                TEXT,
  event_timestamp      TEXT,
  timestamp_precision  TEXT,
  attachment_json      TEXT,
  submitted_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  submission_id  TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  rep_id         TEXT,
  data_json      TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  tags_json     TEXT NOT NULL DEFAULT '[]',
  image_json    TEXT,
  body_html     TEXT NOT NULL,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL,
  published_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_bt ON drafts(bt_id);
CREATE INDEX IF NOT EXISTS idx_submissions_bt ON submissions(bt_id);
CREATE INDEX IF NOT EXISTS idx_events_submission ON events(submission_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
