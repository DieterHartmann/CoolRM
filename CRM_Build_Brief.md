# CLAUDE CODE BUILD BRIEF
## Multi-Tenant CRM SaaS Platform
### Embeddable Widget + Email Workflow Manager + Admin Portal
*May 2026 | v1.0*

---

> **This brief is the source of truth. Read it in full before writing any code. All architectural decisions, phasing, naming conventions, and constraints are defined here. Do not deviate without explicit instruction.**

---

## 1. Project Overview

The platform is a multi-tenant SaaS CRM. Businesses (tenants) sign up, configure an embeddable contact widget, embed it on their website, and manage all inbound communications through a web-based admin portal. The platform handles email channel integration in Phase 1, with WhatsApp Business as a future-phase add-on.

### 1.1 The Two Distinct Sides

**Public-facing:** The embeddable widget — a small vanilla JS bundle that any client drops into their website. Captures visitor contact details and a message. No framework dependencies. Must not conflict with host site CSS or JS.

**Admin portal:** A React web app where each client logs in to manage their contacts, read and respond to email threads, draft replies, and attach files. Multi-tenant with strict per-client isolation.

### 1.2 Core User Journey

1. Visitor lands on client website and sees the embedded widget
2. Visitor submits name, email, phone, and message
3. Platform generates a unique CRM reference number (e.g. `CRM-00142`)
4. A notification email is sent to the client from their own configured email address, with the ref number in the subject line
5. The contact record appears in the client's admin portal
6. Client replies via the portal; reply sends from their email address with ref# in subject
7. Any subsequent email from the visitor that contains the ref# in the subject is pulled into the portal and appended to the thread
8. Emails without a ref# stay only in the client's mailbox and are never ingested

---

## 2. Architecture

### 2.1 Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | Node.js 20 LTS + Fastify | Real-time email polling performance, lightweight Docker footprint on Pi |
| Frontend | React 18 + Vite | SPA, fast builds, easy per-applet tab componentisation |
| Widget | Vanilla JS (esbuild) | No framework, no conflicts, single script tag embed |
| Database | PostgreSQL 16 + Prisma | Schema-per-tenant isolation, robust migrations, JSONB for semi-structured data |
| Auth | Better Auth | Self-hostable, no vendor lock-in, JWT with refresh rotation |
| Email | Gmail API + Microsoft Graph (OAuth2), IMAPFlow fallback, Nodemailer for send | Per-tenant OAuth, reliable incremental sync |
| Billing | Stripe Billing (ZAR) | Native ZAR support, SA bank payouts, best-in-class docs |
| Realtime | Server-Sent Events (SSE) | Lightweight push for new contacts and email events |
| Queue | BullMQ + Redis | Background email polling jobs with retry and backoff |
| Deployment | Docker Compose + GitHub Actions + Tailscale SSH + Cloudflare Tunnel | Matches existing Pi infrastructure |

### 2.2 Tenant Isolation Model

> **This is the most critical architectural constraint.**

Every tenant gets:

- A dedicated PostgreSQL schema named after their internal tenant UUID (e.g. `tenant_a1b2c3`). Never named after the business name.
- A dedicated PostgreSQL role with GRANT permissions scoped only to their schema. The application connects using this role for all tenant-specific queries.
- Row-level security (RLS) policies on all shared tables as a second enforcement layer.
- A unique widget bundle URL and API key containing no human-readable business identifier.

There must be zero possibility of a query written in one tenant context reading data from another tenant schema. This is enforced at the DB role level, not just application logic.

> **NOTE:** Tenant schema names and all internal identifiers must be opaque UUIDs or short random strings. Never use the client's business name in any DB object name, API route, or widget URL.

### 2.3 Docker Compose Services

- `postgres` — PostgreSQL 16 with persistent volume
- `api` — Fastify backend (Node 20)
- `frontend` — Nginx serving the built React app
- `worker` — Background email polling (same codebase as api, different entrypoint)
- `redis` — Job queue for BullMQ

All services on an internal Docker network. Only `frontend` and `api` expose ports through Cloudflare Tunnel.

### 2.4 Deployment Pipeline

- Code lives in a GitHub repo
- GitHub Actions: on push to `main`, SSH into Pi via Tailscale, `git pull`, `docker compose up --build -d`
- Environment variables managed via `.env` on the Pi, never committed to the repo
- Cloudflare Tunnel provides public HTTPS, no router port forwarding required

---

## 3. Repository Structure

Build this exact structure from day one. Do not deviate.

```
crm-platform/
  apps/
    api/              # Fastify backend + worker entrypoint
    web/              # React admin portal (Vite)
    widget/           # Vanilla JS widget bundle (esbuild)
  packages/
    db/               # Prisma schema, migrations, client
    shared/           # Shared types, utils, constants
  docker/             # Dockerfiles per service
  docker-compose.yml
  docker-compose.prod.yml
  .github/
    workflows/        # CI/CD pipeline
  .env.example        # Template — no secrets ever committed
```

---

## 4. Database Schema

### 4.1 Platform-level (`public` schema)

Exists once. Manages tenants and billing, not contact data.

```
tenants
  id                  uuid pk
  slug                text unique (opaque, not business name)
  company_name        text
  owner_email         text
  stripe_customer_id  text
  created_at          timestamptz

applets
  id                    uuid pk
  tenant_id             uuid fk → tenants
  name                  text
  widget_key            text unique (random, opaque)
  is_active             bool
  stripe_subscription_id text
  created_at            timestamptz

users
  id              uuid pk
  tenant_id       uuid fk → tenants
  email           text
  hashed_password text
  role            enum (owner | member)
  created_at      timestamptz

billing_events
  id               uuid pk
  tenant_id        uuid fk
  applet_id        uuid fk
  event_type       text
  stripe_event_id  text
  amount_zar       integer (cents)
  created_at       timestamptz
```

### 4.2 Per-tenant schema (`tenant_{uuid_short}`)

Provisioned automatically on tenant signup. Application connects with a scoped DB role.

```
contacts
  id          uuid pk
  applet_id   uuid
  ref_number  text unique (format: CRM-XXXXX)
  name        text
  email       text
  phone       text
  message     text
  status      enum (new | open | resolved)
  deleted_at  timestamptz (soft delete)
  created_at  timestamptz

threads
  id               uuid pk
  contact_id       uuid fk → contacts
  subject          text
  last_activity_at timestamptz

messages
  id               uuid pk
  thread_id        uuid fk → threads
  direction        enum (inbound | outbound)
  from_address     text
  to_address       text
  subject          text
  body_html        text
  body_text        text
  sent_at          timestamptz
  email_message_id text unique (for dedup)
  has_ref          bool

attachments
  id           uuid pk
  message_id   uuid fk → messages
  filename     text
  mime_type    text
  storage_path text
  size_bytes   integer

email_accounts
  id            uuid pk
  applet_id     uuid
  provider      enum (gmail | outlook | imap)
  oauth_tokens  text (AES-256-GCM encrypted)
  smtp_config   jsonb
  last_sync_at  timestamptz
```

> **NOTE:** `ref_number` format is `CRM-{5-digit zero-padded sequential per tenant}`. Example: `CRM-00001`. Auto-generated on contact creation. Never reused. Never global — sequential per tenant.

---

## 5. Email Integration

### 5.1 How Threading Works

> Understand this completely before building any email functionality.

- On first contact via widget, the platform generates a ref number and stores it on the contact record.
- All outbound emails sent via the portal have `[CRM-XXXXX]` automatically appended to the subject. Example: `Re: Your enquiry [CRM-00042]`
- The email polling worker scans the tenant's connected mailbox for emails whose subject matches `/\[CRM-\d{5}\]/`
- Matched emails are parsed, deduplicated by email `Message-ID` header, and appended to the correct thread in the DB
- Unmatched emails (no ref# in subject) are ignored by the platform entirely
- When a reply is sent from the portal, the originating email in the mailbox is marked as read via the provider API

> **NOTE:** Subject line ref# is chosen over email header metadata (`X-CRM-Ref` etc.) because headers are not reliably preserved across mail clients and forwarding chains. Subject line is the only robust cross-client approach.

### 5.2 Email Polling Worker

- Runs on a configurable interval (default: 60 seconds) via BullMQ + Redis
- One job per connected email account
- Uses IMAP SEARCH or Gmail API history for efficient incremental sync — not a full inbox scan
- Deduplication via `email_message_id` stored in the `messages` table
- Errors logged and retried with exponential backoff

### 5.3 OAuth Flow per Tenant

- Each tenant connects their email account via OAuth2 in portal settings
- Support Gmail (Google OAuth) and Outlook (Microsoft OAuth) in Phase 1
- Tokens stored encrypted in `email_accounts.oauth_tokens` (AES-256-GCM, key in env)
- Token refresh handled automatically by the worker before each sync

### 5.4 Sending Email

- All outbound mail sends from the tenant's configured email address via their OAuth token
- Nodemailer with OAuth2 transport
- Ref# appended to subject automatically before send
- Sent message stored in `messages` table with `direction = 'outbound'`

---

## 6. The Embeddable Widget

### 6.1 Technical Spec

- Single vanilla JS file, compiled with esbuild. Target: ~15-20kb gzipped.
- No external dependencies, no framework
- Injected via a single `<script>` tag that clients paste into their site
- Renders inside a sandboxed iframe served from the platform domain (not the client site)
- This prevents CSS bleed from the host site in both directions

### 6.2 Embed Code Format

```html
<script src="https://yourdomain.com/widget.js"
  data-key="wk_a1b2c3d4e5f6"
  defer></script>
```

- `data-key` is the applet's `widget_key` from the DB — opaque, no business identifier
- The widget reads the key, calls the platform API to validate and fetch config, then renders the iframe
- Multiple applets are supported; each gets a unique key

### 6.3 Widget Form Fields (Phase 1)

- Full name (required)
- Email address (required, validated)
- Phone number (optional)
- Message (required, textarea)
- Submit button

Build with clear component boundaries so additional field types or chat-mode can be added later without a rewrite.

### 6.4 Post-Submit Flow

1. Form submits to `POST /api/v1/contacts` with `widget_key`
2. API creates contact record, generates ref#, triggers email notification to client
3. Widget shows success confirmation
4. No redirect, no page reload

---

## 7. Admin Portal

### 7.1 Structure

Single React SPA. After login, the user sees a sidebar with one tab per applet. Clicking a tab switches context to that applet's contacts and threads.

- Top-level nav: Applets (tabs), Settings, Billing, Account
- Per-applet view: Contacts list, open threads, resolved threads
- Thread view: full message history, reply composer, file attachment
- Settings per applet: email account connection, widget embed code, applet name

### 7.2 Reply Composer

- Rich text editor (Tiptap preferred)
- File attachment: drag and drop + file picker
- Supported types: PDF, DOCX, XLSX, PNG, JPG, ZIP
- Max attachment size: 10MB per file, 25MB per send
- On send: email dispatched, message written to DB, thread updated, composer cleared

### 7.3 Realtime Updates

- On portal load, client opens SSE connection to `GET /api/v1/events` (authenticated)
- Server pushes: `new_contact`, `new_message`, `thread_updated`
- Frontend updates UI without page refresh

### 7.4 Tenant Onboarding (must be fully self-serve)

1. User signs up with email + password on the platform
2. Email verification sent
3. On verification, tenant schema provisioned automatically
4. User prompted to create first applet (name it, connect email)
5. Embed code displayed immediately
6. User pastes it into their website
7. Done. Zero manual steps. Zero support tickets.

---

## 8. Authentication and Security

### 8.1 Auth

- Better Auth for session management. JWT, short expiry, refresh token rotation.
- All API routes require a valid session token except `POST /api/v1/contacts` and auth routes.
- Every authenticated request middleware must resolve `tenant_id` from the session and set the PostgreSQL `search_path` to that tenant's schema before any DB query.
- Never trust a `tenant_id` passed in the request body or query params for data access decisions. Always derive from the session.

### 8.2 Widget Endpoint Security

- `POST /api/v1/contacts` is public but requires a valid `widget_key`
- Rate limited: 10 submissions per IP per hour per applet
- `widget_key` lookup must verify the applet is active

### 8.3 General Security

- All secrets via environment variables. Never hardcoded. App must fail loudly on startup if required env vars are missing (validate with Zod).
- OAuth tokens at rest encrypted with AES-256-GCM
- Input validation on all endpoints with Zod
- CORS restricted to platform domain and configured client domains
- Helmet.js for HTTP security headers
- All DB queries via Prisma parameterised queries (no raw SQL unless absolutely necessary, and if so, explicitly comment why)

---

## 9. Billing

### 9.1 Model

Per active applet, per month. Billed in ZAR via Stripe. Price: **R500 per applet per month.**

- Each `is_active = true` applet generates a monthly charge
- Stripe Products and Prices configured for ZAR currency
- One Stripe Customer per tenant (created on signup)
- One Stripe Subscription per applet (created on applet activation)

### 9.2 Phase 1 Approach

Stripe scaffolding must be in place from Phase 1, but payment collection can be deferred. The architecture must support activating full billing with minimal code changes.

- Stripe customer and subscription records created immediately
- Platform owner can manually set applet billing status via a protected admin route
- Build the Stripe webhook handler from the start: handle `payment_succeeded`, `payment_failed`, `subscription_cancelled`

### 9.3 Billing UI

- Billing tab: list of active applets, per-applet cost, next billing date, payment method
- Client updates payment method via Stripe Customer Portal (hosted by Stripe)
- Applet deactivates automatically after payment failure retry period

---

## 10. Build Phases

> Build in this exact order. Do not start a phase until the previous phase is working and tested.

### Phase 1 — Foundation

- Docker Compose setup with all services scaffolded
- PostgreSQL platform schema and Prisma migrations
- Tenant provisioning: signup, email verification, automatic schema creation
- Better Auth integration with tenant-scoped sessions
- Applet creation with `widget_key` generation
- Vanilla JS widget bundle with contact form
- `POST /api/v1/contacts` with rate limiting
- Email notification to client on new contact (basic SMTP, no OAuth yet)
- Admin portal scaffold: login, applet tabs, contacts list
- GitHub Actions deploy pipeline to Pi

### Phase 2 — Email Integration

- Gmail OAuth2 flow in portal settings
- Outlook OAuth2 flow in portal settings
- Email polling worker (BullMQ + Redis)
- Thread ingestion: ref# detection, dedup, DB write
- Thread view in admin portal
- Reply composer with file attachment
- Outbound send via tenant email with ref# injection
- Mark-as-read on originating email after portal reply
- SSE realtime updates to portal

### Phase 3 — Billing

- Stripe customer creation on tenant signup
- Stripe subscription creation on applet activation
- Stripe webhook handler
- Billing tab in admin portal
- Stripe Customer Portal integration
- Applet suspension on payment failure

### Phase 4 — Polish and Scale

- IMAP fallback for non-Gmail/Outlook providers
- Platform admin dashboard (your view: all tenants, revenue, health)
- Applet tab skinning architecture (structure only, no themes yet)
- WhatsApp Business API scaffolding (stub module, not implemented)
- Structured logging + error tracking (Sentry or self-hosted Glitchtip)
- Automated PostgreSQL volume backups

---

## 11. Conventions and Rules

### 11.1 Code

- TypeScript throughout. Strict mode. No `any`.
- ESLint + Prettier enforced. Config files in repo root.
- All environment variables declared in a central config module, validated on startup with Zod. Fail loudly if anything is missing.
- No hardcoded strings for tenant identifiers, API keys, or secrets anywhere.
- All async functions handle errors explicitly. No unhandled promise rejections.

### 11.2 API

- REST. Versioned routes: `/api/v1/...`
- All responses use a consistent envelope: `{ success: boolean, data: any, error?: string }`
- Zod validation on all request bodies and query params
- HTTP status codes used correctly: 200, 201, 400, 401, 403, 404, 429, 500

### 11.3 Database

- All migrations via `prisma migrate`. Never modify the DB directly.
- Schema names: `tenant_{first_8_chars_of_tenant_uuid}`
- All timestamps in UTC, stored as `timestamptz`
- Soft deletes on contacts and threads (`deleted_at` column). Never hard delete.

### 11.4 Git

- Branch: `main` (production). Feature branches for all work.
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Never commit `.env` files. Keep `.env.example` current.

---

## 12. Future Scope (Pinned — Do Not Build Yet)

These are confirmed future features. Architecture decisions today must not block them.

- **WhatsApp Business API** — Meta Cloud API (official). Same threading principles as email. Optional add-on per applet, billed separately.
- **Applet tab skinning** — per-applet colour themes and branding in the admin portal.
- **Live chat / async messaging** — widget evolves beyond a contact form.
- **Multi-user per tenant** — team members with roles.
- **Mobile app** — admin portal on iOS/Android.

> When building Phase 1 and 2, always ask: does this decision make any of the above harder to add later? If yes, choose the more extensible approach.

---

*Build Phase 1 first. Ship it. Then Phase 2.*
