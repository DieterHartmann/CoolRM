-- Tenant schema DDL
-- Applied once per tenant at provisioning time.
-- Executed with search_path already set to the tenant schema,
-- so all table references are unqualified and resolve correctly.
-- Do not use schema-qualified names here.

-- Sequential ref number counter (per-tenant, never global)
CREATE SEQUENCE IF NOT EXISTS contact_ref_seq START 1;

CREATE TABLE IF NOT EXISTS contacts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applet_id     UUID        NOT NULL,
  ref_number    TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT,
  message       TEXT,
  custom_fields JSONB,
  status        TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'open', 'resolved')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contacts_ref_number_unique UNIQUE (ref_number)
);

CREATE TABLE IF NOT EXISTS threads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID        NOT NULL REFERENCES contacts(id),
  subject          TEXT        NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID        NOT NULL REFERENCES threads(id),
  direction        TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address     TEXT        NOT NULL,
  to_address       TEXT        NOT NULL,
  subject          TEXT        NOT NULL,
  body_html        TEXT,
  body_text        TEXT,
  sent_at          TIMESTAMPTZ NOT NULL,
  email_message_id TEXT,
  has_ref          BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT messages_email_message_id_unique UNIQUE (email_message_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID    NOT NULL REFERENCES messages(id),
  filename     TEXT    NOT NULL,
  mime_type    TEXT    NOT NULL,
  storage_path TEXT    NOT NULL,
  size_bytes   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applet_id    UUID        NOT NULL,
  provider     TEXT        NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  oauth_tokens TEXT,
  smtp_config  JSONB,
  last_sync_at TIMESTAMPTZ
);

-- Idempotent column additions for schema evolution (safe to re-run on existing tenants)
ALTER TABLE contacts ALTER COLUMN message DROP NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_applet_id   ON contacts(applet_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status      ON contacts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email       ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_threads_contact_id   ON threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id   ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_applet ON email_accounts(applet_id);
