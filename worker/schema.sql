-- Early Adopter Platform D1 schema

CREATE TABLE IF NOT EXISTS early_adopters (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT,
  password_salt         TEXT,
  activation_token      TEXT UNIQUE,                     -- one-time link token; NULL once password is set
  enrollment_date       TEXT NOT NULL,
  referral_source       TEXT,                          -- how they joined (nullable)
  referral_code         TEXT NOT NULL UNIQUE,           -- what they hand out to refer others
  install_status        TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'installed'
  representing_ack_at   TEXT,                           -- NULL until acknowledged
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id            TEXT PRIMARY KEY,
  ea_id         TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id             TEXT PRIMARY KEY,
  ea_id          TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  what_happened  TEXT NOT NULL,
  expected       TEXT NOT NULL,
  urgency        TEXT NOT NULL, -- 'low' | 'medium' | 'high'
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id            TEXT PRIMARY KEY,
  ea_id         TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  ea_id       TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_ea ON feedback(ea_id);
CREATE INDEX IF NOT EXISTS idx_bugs_ea ON bug_reports(ea_id);
CREATE INDEX IF NOT EXISTS idx_contact_ea ON contact_messages(ea_id);
CREATE INDEX IF NOT EXISTS idx_sessions_ea ON sessions(ea_id);
