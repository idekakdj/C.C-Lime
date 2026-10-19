CREATE TABLE accounts (
  uid TEXT PRIMARY KEY,
  user_handle TEXT NOT NULL UNIQUE,
  epoch INTEGER NOT NULL DEFAULT 0,
  min_auth_time INTEGER NOT NULL DEFAULT 0,
  valid_since INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  last_checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES accounts(uid),
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL CHECK(counter >= 0),
  revision INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL CHECK(device_type IN ('singleDevice','multiDevice')),
  backed_up INTEGER NOT NULL CHECK(backed_up IN (0,1)),
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX credentials_owner ON credentials(uid, revoked_at);
CREATE TABLE flows (
  ticket TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK(operation IN ('register','authenticate')),
  proof_hash TEXT NOT NULL,
  redirect TEXT NOT NULL,
  state TEXT NOT NULL,
  uid TEXT,
  auth_time INTEGER,
  valid_since INTEGER,
  label TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verifying','complete','consumed')),
  completion_code TEXT UNIQUE,
  credential_id TEXT,
  completed_at INTEGER
);
CREATE INDEX flows_expiry ON flows(expires_at);
CREATE TABLE request_limits (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
