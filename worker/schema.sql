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
  is_admin              INTEGER NOT NULL DEFAULT 0,      -- 1 = can view the Administrator Platform
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id                  TEXT PRIMARY KEY,
  ea_id               TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  feedback_type       TEXT NOT NULL,   -- 'suggestion'|'confusing'|'liked'|'disliked'|'other'
  importance          TEXT NOT NULL,   -- 'nice_to_have'|'better_experience'|'important'|'blocking'
  message             TEXT NOT NULL,
  where_encountered   TEXT,
  additional_notes    TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id                    TEXT PRIMARY KEY,
  ea_id                 TEXT NOT NULL REFERENCES early_adopters(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  issue_type            TEXT NOT NULL,   -- 'hardware'|'software'|'usability'|'performance'|'feature'|'security'|'other'
  severity              TEXT NOT NULL,   -- 'blocking'|'high'|'medium'|'low'
  what_happened         TEXT NOT NULL,
  steps_to_reproduce    TEXT,
  expected              TEXT NOT NULL,
  actual                TEXT,
  env_browser           TEXT,
  env_os                TEXT,
  env_device            TEXT,
  env_screen            TEXT,
  attachment_json       TEXT,
  frequency             TEXT,   -- 'once'|'occasionally'|'always'
  can_reproduce         TEXT,   -- 'yes'|'no'|'not_sure'
  diagnostics           TEXT,
  tester_context        TEXT,
  regression            TEXT,   -- 'yes'|'no'|'not_sure'
  blocking_feature      TEXT,   -- 'yes'|'no'
  follow_up_ok          TEXT,   -- 'yes'|'no'
  created_at            TEXT NOT NULL
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
