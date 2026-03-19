# Tenant Isolation Test Contract

## Source Anchors
- Tenant tests suite region: #codebase test/index.spec.js:383-609
- Additional module/subdomain regression tests: #codebase test/index.spec.js:715-789

## Implemented Isolation Tests

### 1) Staff PIN + Booking Read Isolation by Subdomain
- Test: `enforces tenant isolation for same staff PIN and booking reads by subdomain`
- Verifies:
  - company 1 booking list excludes company 2 bookings
  - company 2 booking list excludes company 1 bookings
  - same PIN (`1111`) authenticates to tenant-specific staff by host
- Anchor: #codebase test/index.spec.js:383-466

### 2) Cross-Tenant Stage Update Override Block
- Test: `blocks cross-tenant booking stage updates via body companyId override`
- Verifies host-scoped route rejects `companyId` body override with 403 and booking stage remains unchanged.
- Anchor: #codebase test/index.spec.js:467-514

### 3) SSE Event Isolation by Company
- Test: `routes booking creation and stage-update SSE notifications per company`
- Verifies each stream receives only tenant-matching booking + stage events.
- Anchor: #codebase test/index.spec.js:515-609

### 4) Related Regression Coverage
- Booking module gate rejection: #codebase test/index.spec.js:715-750
- Empty subdomain allowed (single-domain mode): #codebase test/index.spec.js:751-789

## Step-3 Placeholder Tests (Pending)
- [ ] Main-domain tenant-required route fails with `tenant_required`.
- [ ] Unknown subdomain fails with tenant-not-found response.
- [ ] Resolver `override_not_allowed` path is asserted through unified guard path.
- [ ] Allowed localhost/workers override succeeds only when company exists.
- [ ] Guard ordering test: tenant guard executes before module/auth/DB logic.
