# Identity Auth Migration Spec

## Purpose

This spec defines step 1 of CP-3E: the target data model and migration plan for moving signup, Restaurant Admin, and SaaS Admin from PIN-first access to identity-based authentication.

It is deliberately additive. The goal is to introduce identity auth without breaking the existing booking runtime or the current Booking Board PIN flow.

## Approved Product Direction

- Signup uses email as the baseline identity path.
- Google OAuth is optional acceleration, not the only login path.
- Restaurant Admin uses identity-based session auth.
- SaaS Admin uses identity-based session auth.
- Booking Board remains PIN-based for speed.
- Booking Board PIN must be board-scoped only and must not unlock Restaurant Admin or SaaS Admin.

## Current Runtime Reality

The active runtime already has these core entities:

- `organizations`: commercial customer account container
- `companies`: operational tenant unit used by website, admin, board, and settings
- `staff`: operational users with tenant-scoped PINs
- `platform_signups`: signup/audit record with `owner_email`, `owner_phone`, `company_id`, `organization_id`

The migration must build on these facts rather than reintroducing a separate generic `tenants` model.

## Non-Goals

- Do not remove `staff` in this migration.
- Do not move Booking Board away from PIN in CP-3E.
- Do not redesign RBAC for every future module up front.
- Do not require a big-bang cutover where all existing admin flows break until Google is wired.

## Design Principles

1. Add identity tables first. Do not rewrite runtime auth and schema in the same step.
2. Keep `staff` for operational roles and board unlock.
3. Separate human identity from tenant-operational role records.
4. Keep organization scope and company scope explicit.
5. Prefer email magic link first because it is the lowest-friction baseline.
6. Treat Google as an additional identity provider bound to the same user record.
7. Use session cookies for admin surfaces; avoid token-in-query for browser auth.

## Target Auth Model

### Identity layer

- `users`: canonical human identity record
- `user_identities`: login methods bound to a user (`email_magic_link`, `google`)
- `auth_sessions`: browser sessions for admin surfaces
- `auth_challenges`: one-time magic-link or verification challenges

### Authorization layer

- `platform_operator_memberships`: access to SaaS Admin
- `organization_memberships`: customer-account access at organization level
- `company_memberships`: tenant access for Restaurant Admin and future scoped admin roles

### Operational layer

- `staff`: remains for board and operational workflows
- `staff.pin`: becomes explicitly board-only or kiosk-only

## Target Tables

### 1. users

Purpose: canonical human identity shared across all login methods.

```sql
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	primary_email TEXT NOT NULL,
	primary_email_normalized TEXT NOT NULL UNIQUE,
	display_name TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	last_login_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_primary_email_normalized
	ON users(primary_email_normalized);
```

Validation:

- `primary_email_normalized` is lowercase and trimmed
- `status` enum: `pending_verification`, `active`, `suspended`, `disabled`

### 2. user_identities

Purpose: bind multiple login providers to the same user.

```sql
CREATE TABLE IF NOT EXISTS user_identities (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	provider TEXT NOT NULL,
	provider_subject TEXT,
	email TEXT,
	email_normalized TEXT,
	is_primary INTEGER NOT NULL DEFAULT 0,
	verified_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
	ON user_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_provider_email
	ON user_identities(provider, email_normalized);
```

Notes:

- For `email_magic_link`, `provider_subject` may stay null initially; uniqueness then comes from normalized email lookup.
- For `google`, `provider_subject` is the stable Google `sub` claim.

Provider enum for current scope:

- `email_magic_link`
- `google`

### 3. auth_challenges

Purpose: store one-time login or verification challenges for email magic link.

```sql
CREATE TABLE IF NOT EXISTS auth_challenges (
	id TEXT PRIMARY KEY,
	challenge_type TEXT NOT NULL,
	email_normalized TEXT,
	user_id TEXT,
	organization_id INTEGER,
	company_id INTEGER,
	token_hash TEXT NOT NULL UNIQUE,
	redirect_path TEXT,
	expires_at TEXT NOT NULL,
	consumed_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_email
	ON auth_challenges(email_normalized);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
	ON auth_challenges(expires_at);
```

Challenge types for current scope:

- `signup_email_verify`
- `admin_login_magic_link`
- `platform_admin_login_magic_link`
- `email_change_verify`

### 4. auth_sessions

Purpose: durable session store for admin browser sessions.

```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	session_scope TEXT NOT NULL,
	organization_id INTEGER,
	company_id INTEGER,
	impersonated_by_user_id TEXT,
	ip_hash TEXT,
	user_agent_hash TEXT,
	last_seen_at TEXT,
	expires_at TEXT NOT NULL,
	revoked_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
	ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_company_id
	ON auth_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
	ON auth_sessions(expires_at);
```

Session scopes for current scope:

- `platform_admin`
- `restaurant_admin`

### 5. platform_operator_memberships

Purpose: grant SaaS Admin access independently from restaurant-specific memberships.

```sql
CREATE TABLE IF NOT EXISTS platform_operator_memberships (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(user_id, role)
);
```

Roles for current scope:

- `platform_admin`
- `platform_operator`

### 6. organization_memberships

Purpose: bind a user to the commercial customer account.

```sql
CREATE TABLE IF NOT EXISTS organization_memberships (
	id TEXT PRIMARY KEY,
	organization_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(organization_id, user_id, role)
);
```

Roles for current scope:

- `organization_owner`
- `organization_admin`
- `organization_billing`

### 7. company_memberships

Purpose: bind a user to the operational tenant admin surface.

```sql
CREATE TABLE IF NOT EXISTS company_memberships (
	id TEXT PRIMARY KEY,
	company_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	source TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (company_id) REFERENCES companies(id),
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(company_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_id
	ON company_memberships(company_id);
```

Roles for current scope:

- `tenant_admin`
- `manager`
- `viewer`

## Existing Table Reinterpretation

### staff

Keep `staff` as the operational roster.

New rule after migration:

- `staff.pin` is not valid for Restaurant Admin
- `staff.pin` is not valid for SaaS Admin
- `staff.pin` is valid for Booking Board only

Optional later addition:

```sql
ALTER TABLE staff ADD COLUMN auth_scope TEXT DEFAULT 'board_only';
```

This column is optional for step 1. The main requirement is that runtime enforcement changes later in CP-3F.

### platform_signups

Keep `platform_signups` as the source for backfilling owner identity bootstrap.

Important fields:

- `owner_email`
- `owner_phone`
- `organization_id`
- `company_id`

### organizations and companies

These remain authoritative. The new auth tables reference them.

## Backfill Mapping Rules

Backfill order:

1. `platform_signups.owner_email`
2. `companies.email`
3. `organizations.billing_email`

### Bootstrap user creation rule

For each company:

- choose the best available normalized email from the ordered sources above
- create or reuse a `users` row by normalized email
- create `organization_memberships` with `organization_owner` if organization exists
- create `company_memberships` with `tenant_admin`
- mark `source = 'signup_bootstrap'` in membership metadata or source column where available

### Platform operator bootstrap rule

Do not guess platform-operator identities from old PIN users automatically unless the operator email source is authoritative.

Safer default:

- create the table
- seed platform operator memberships manually through an explicit bootstrap script or env-configured email allowlist

This avoids accidental elevation from old PIN-based operator flows.

## Migration Phases

### Phase 0 — Documentation and contract freeze

Done in current step.

Outputs:

- this spec
- checkpoint updates for `CP-3E` and `CP-3F`
- product/architecture docs aligned to identity direction

### Phase 1 — Additive schema migration

Add new tables only:

- `users`
- `user_identities`
- `auth_challenges`
- `auth_sessions`
- `platform_operator_memberships`
- `organization_memberships`
- `company_memberships`

Requirements:

- no existing runtime path is broken
- no old auth path is removed
- migrations are idempotent

### Phase 2 — Backfill bootstrap identities

Run a one-time migration script:

- create users from existing owner emails
- create tenant-admin memberships
- create optional organization-owner memberships
- record any companies with missing usable email in a review list

Output artifact:

- migration summary report with counts:
	- users created
	- users reused
	- memberships created
	- companies missing email bootstrap

### Phase 3 — Dual-stack auth introduction

Add new runtime paths while keeping old ones alive:

- email magic-link request endpoint
- magic-link callback endpoint
- Google OAuth start and callback endpoints
- session middleware for `/admin` and `/platform/admin`

Compatibility rule:

- Booking Board still uses PIN
- old PIN-based admin path may remain behind a feature flag for a short migration window only

### Phase 4 — Restaurant Admin cutover

Switch Restaurant Admin browser UI to session auth.

Requirements:

- no admin UI route depends on `staff.pin`
- tenant resolution comes from authenticated membership or explicit session-bound company context
- admin query override hacks are removed or reduced to dev diagnostics only

### Phase 5 — SaaS Admin cutover

Switch SaaS Admin to session auth using `platform_operator_memberships`.

Requirements:

- no operator PIN is accepted as primary auth
- operator access is email or Google-based
- operator sessions are auditable and revocable

### Phase 6 — Booking Board scope hardening

Part of `CP-3F`.

Requirements:

- board is launched from Restaurant Admin
- board PIN becomes board-only in runtime enforcement
- board launch can later use a short-lived launch token or tenant-bound station token

## Migration SQL Bundle (Step 1 Additive)

```sql
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	primary_email TEXT NOT NULL,
	primary_email_normalized TEXT NOT NULL UNIQUE,
	display_name TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	last_login_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_identities (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	provider TEXT NOT NULL,
	provider_subject TEXT,
	email TEXT,
	email_normalized TEXT,
	is_primary INTEGER NOT NULL DEFAULT 0,
	verified_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS auth_challenges (
	id TEXT PRIMARY KEY,
	challenge_type TEXT NOT NULL,
	email_normalized TEXT,
	user_id TEXT,
	organization_id INTEGER,
	company_id INTEGER,
	token_hash TEXT NOT NULL UNIQUE,
	redirect_path TEXT,
	expires_at TEXT NOT NULL,
	consumed_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	session_scope TEXT NOT NULL,
	organization_id INTEGER,
	company_id INTEGER,
	impersonated_by_user_id TEXT,
	ip_hash TEXT,
	user_agent_hash TEXT,
	last_seen_at TEXT,
	expires_at TEXT NOT NULL,
	revoked_at TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS platform_operator_memberships (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
	id TEXT PRIMARY KEY,
	organization_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (organization_id) REFERENCES organizations(id),
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(organization_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS company_memberships (
	id TEXT PRIMARY KEY,
	company_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	source TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_by TEXT,
	FOREIGN KEY (company_id) REFERENCES companies(id),
	FOREIGN KEY (user_id) REFERENCES users(id),
	UNIQUE(company_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_users_primary_email_normalized
	ON users(primary_email_normalized);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
	ON user_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_provider_email
	ON user_identities(provider, email_normalized);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_email
	ON auth_challenges(email_normalized);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
	ON auth_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
	ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_company_id
	ON auth_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
	ON auth_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_id
	ON company_memberships(company_id);
```

## Runtime Contract Changes Required After Schema Exists

These are not part of step 1 implementation, but the schema is designed for them.

### New auth endpoints

- `POST /api/auth/email/request-link`
- `GET /auth/email/callback`
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Existing endpoint contract changes

- `POST /api/platform/signup` should stop returning admin PIN bootstrap data
- Restaurant Admin routes should stop accepting admin PIN as primary auth
- SaaS Admin routes should stop accepting operator PIN as primary auth
- `GET /api/staff/auth` should become board-focused only

## Cookie and Session Rules

- browser auth uses `HttpOnly`, `Secure`, `SameSite=Lax` cookie sessions
- session TTL should be shorter for platform operator sessions than general tenant-admin sessions
- session revocation must be server-side, not client-trust only

## Rollback Strategy

Rollback for step 1 is safe because the migration is additive.

If runtime rollout stalls:

- leave the new tables in place
- keep old PIN admin flows temporarily
- do not delete backfilled users or memberships
- pause cutover at phase 2 or phase 3 until session auth is stable

Do not drop the new tables during rollback unless a schema bug forces it. The cheaper path is to keep them idle.

## Acceptance Criteria For Step 1

- target auth schema is defined against the real `organizations` and `companies` model
- migration phases are explicit and additive
- backfill rules are deterministic
- platform operator bootstrap is intentionally manual or allowlist-based, not guessed from legacy PIN data
- board PIN remains explicitly out of scope for admin auth
- the spec is precise enough to implement schema migration files and backfill scripts next

## Immediate Next Files After This Spec

1. `src/db/schema-sql.js`
Add the new auth tables.

2. `src/db/init.js`
Only if minimal seed/bootstrap behavior is needed for local development.

3. `docs/contracts/API_CONTRACTS.md`
Define email magic-link and Google auth endpoints.

4. `docs/contracts/SECURITY_CONTRACTS.md`
Replace PIN-first admin assumptions with the new split: identity sessions for admin, PIN for board.

5. Backfill script
Create a dedicated migration or script that reads `platform_signups`, `companies`, and `organizations` to seed `users` and memberships.
