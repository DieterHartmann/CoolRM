-- Platform schema — initial migration
-- Idempotent: uses IF NOT EXISTS throughout. Safe to run on every startup.

-- Better Auth: user
CREATE TABLE IF NOT EXISTS "user" (
  "id"             TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "email"          TEXT        NOT NULL,
  "email_verified" BOOLEAN     NOT NULL DEFAULT FALSE,
  "image"          TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL,
  "updated_at"     TIMESTAMPTZ NOT NULL,
  "tenant_id"      TEXT,
  "role"           TEXT        NOT NULL DEFAULT 'owner',
  "company_name"   TEXT,
  CONSTRAINT "user_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "user_email_unique" UNIQUE ("email")
);

-- Better Auth: session
CREATE TABLE IF NOT EXISTS "session" (
  "id"          TEXT        NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "token"       TEXT        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL,
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "user_id"     TEXT        NOT NULL,
  CONSTRAINT "session_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "session_token_unique" UNIQUE ("token"),
  CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Better Auth: account
CREATE TABLE IF NOT EXISTS "account" (
  "id"                        TEXT        NOT NULL,
  "account_id"                TEXT        NOT NULL,
  "provider_id"               TEXT        NOT NULL,
  "user_id"                   TEXT        NOT NULL,
  "access_token"              TEXT,
  "refresh_token"             TEXT,
  "id_token"                  TEXT,
  "access_token_expires_at"   TIMESTAMPTZ,
  "refresh_token_expires_at"  TIMESTAMPTZ,
  "scope"                     TEXT,
  "password"                  TEXT,
  "created_at"                TIMESTAMPTZ NOT NULL,
  "updated_at"                TIMESTAMPTZ NOT NULL,
  CONSTRAINT "account_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Better Auth: verification
CREATE TABLE IF NOT EXISTS "verification" (
  "id"          TEXT        NOT NULL,
  "identifier"  TEXT        NOT NULL,
  "value"       TEXT        NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "created_at"  TIMESTAMPTZ,
  "updated_at"  TIMESTAMPTZ,
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- Platform: tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id"                  TEXT        NOT NULL,
  "slug"                TEXT        NOT NULL,
  "company_name"        TEXT        NOT NULL,
  "owner_email"         TEXT        NOT NULL,
  "stripe_customer_id"  TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenants_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "tenants_slug_unique" UNIQUE ("slug")
);

-- Platform: applets
CREATE TABLE IF NOT EXISTS "applets" (
  "id"                    TEXT        NOT NULL,
  "tenant_id"             TEXT        NOT NULL,
  "name"                  TEXT        NOT NULL,
  "widget_key"            TEXT        NOT NULL,
  "is_active"             BOOLEAN     NOT NULL DEFAULT FALSE,
  "stripe_subscription_id" TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "applets_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "applets_widget_key_unique" UNIQUE ("widget_key"),
  CONSTRAINT "applets_tenant_id_fkey"   FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);

-- Platform: billing_events
CREATE TABLE IF NOT EXISTS "billing_events" (
  "id"               TEXT        NOT NULL,
  "tenant_id"        TEXT        NOT NULL,
  "applet_id"        TEXT        NOT NULL,
  "event_type"       TEXT        NOT NULL,
  "stripe_event_id"  TEXT        NOT NULL,
  "amount_zar"       INTEGER     NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "billing_events_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "billing_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "billing_events_applet_id_fkey" FOREIGN KEY ("applet_id") REFERENCES "applets"("id")
);
