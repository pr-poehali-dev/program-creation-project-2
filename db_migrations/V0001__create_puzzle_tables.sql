CREATE TABLE IF NOT EXISTS puzzle_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  stopped_at TIMESTAMP,
  keys_checked BIGINT DEFAULT 0,
  status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS puzzle_found (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  private_key TEXT NOT NULL,
  address TEXT NOT NULL,
  found_at TIMESTAMP DEFAULT NOW()
);
