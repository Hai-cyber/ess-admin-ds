# Module Contracts — Restaurant OS

**Purpose**: Define what each module must implement and how they interact.

**Principle**: Modules are independent units exchanging data via well-defined interfaces.

---

## Module Framework

### Required structure

```
src/modules/{module_name}/
├── api.js           -- HTTP handler exports
├── db.js            -- D1 queries (all filter by tenant_id)
├── schema.json      -- Config payload validation (JSON schema)
├── README.md        -- Purpose, routes, dependencies
├── __tests__/       -- Unit + integration tests
│   ├── api.spec.js
│   ├── db.spec.js
│   └── integration.spec.js
└── types.ts         -- TypeScript definitions (optional)
```

### Module lifecycle

```
Worker receives request
  ↓
Router dispatches to module.handle()
  ↓
Module validates tenant context
  ↓
Module parses input (query, body, headers)
  ↓
Module calls db.* functions (all filtered by tenant_id)
  ↓
Module returns response (ok: true) or error (ok: false)
  ↓
Worker sends HTTP response
```

---

## Core Module Contracts

### AUTH Module

**Purpose**: PIN-based authentication, role management

**File**: `src/modules/auth/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // POST /auth/login
    // POST /auth/logout
  }
};

// db.js
export async function getStaff(db, tenant_id, pin) {
  return db
    .prepare('SELECT * FROM staff WHERE tenant_id = ? AND pin = ?')
    .bind(tenant_id, hashPin(pin))
    .first();
}

export async function createStaff(db, tenant_id, staffData) {
  return db
    .prepare(
      `INSERT INTO staff 
       (id, tenant_id, name, pin, role, permissions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(uuidv4(), tenant_id, staffData.name, hashPin(staffData.pin), ...)
    .run();
}
```

**Dependencies**: None (core)

**Exports to other modules**:
- `getStaff(db, tenant_id, pin)` — returns staff record
- `verifyPermission(staff, permission)` — checks if staff has permission

---

### BOOKING Module ✅

**Purpose**: Online reservations, stage management, notifications

**File**: `src/modules/booking/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // POST /api/bookings/create
    // GET /api/bookings?date=...
    // POST /api/bookings/{id}/stage
    // DELETE /api/bookings/{id}
    // GET /api/notifications/stream (SSE)
  }
};

// db.js
export async function createBooking(db, tenant_id, bookingData) {
  // INSERT INTO bookings WITH tenant_id
}

export async function getBookings(db, tenant_id, date) {
  // SELECT FROM bookings WHERE tenant_id = ? AND booking_date = ?
}

export async function updateStage(db, tenant_id, booking_id, new_stage) {
  // UPDATE bookings SET stage = ? WHERE tenant_id = ? AND id = ?
  // LOG to booking_actions table for audit trail
}
```

**Dependencies**: 
- `auth.verifyPermission()` — Check if staff can stage-update
- `notifications.send()` — Send SMS/email on confirmation

**Publishes events**:
- `booking:created` → SSE subscribers
- `booking:stage-update` → SSE subscribers
- `booking:reminded` → SMS to customer

---

### POS Module (Phase 3)

**Purpose**: Table management, order entry, kitchen workflow

**File**: `src/modules/pos/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // GET /api/pos/tables
    // POST /api/pos/orders
    // GET /api/pos/orders?status=...
    // PUT /api/pos/orders/{id}/items
    // POST /api/pos/orders/{id}/payment
    // GET /api/pos/receipt/{id}
  }
};

// db.js
export async function getTables(db, tenant_id) {
  // SELECT FROM tables WHERE tenant_id = ?
}

export async function createOrder(db, tenant_id, orderData) {
  // INSERT INTO orders WITH tenant_id
  // UPDATE tables SET current_order_id = ?
}

export async function getKitchenDisplay(db, tenant_id) {
  // SELECT orders WHERE tenant_id = ? AND status IN ('sent_to_kitchen', 'ready')
  // Ordered by created_at
}
```

**Dependencies**:
- `auth.verifyPermission()` — Staff PIN required
- `booking.getBooking()` — Link order to booking
- `payment.charge()` — Process payment (Phase 3)
- `notifications.send()` — Alert kitchen, customer

**Publishes events**:
- `order:created` → Dashboard
- `order:sent-to-kitchen` → KDS
- `order:ready` → Staff app
- `order:served` → Dashboard

---

### PAYMENT Module (Phase 3)

**Purpose**: Stripe integration, transaction audit, receipts

**File**: `src/modules/payment/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // POST /api/payments/charge
    // POST /api/payments/refund
    // GET /api/transactions?date=...
  }
};

// db.js
export async function createPayment(db, tenant_id, paymentData) {
  // INSERT INTO payments WITH tenant_id
  // Store stripe_transaction_id for audit
}

export async function logTransaction(db, tenant_id, paymentData) {
  // Record in audit_log for compliance (TSE)
}
```

**Dependencies**:
- `stripe` SDK (external)
- `fiskaly` SDK for TSE (external)
- `pos.getOrder()` — Link to order

**Publishes events**:
- `payment:completed` → Dashboard
- `payment:failed` → Staff+ warning

---

### ADMIN Module

**Purpose**: Restaurant configuration, staff management, reporting

**File**: `src/modules/admin/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // GET /api/admin/dashboard
    // GET /api/admin/settings
    // PUT /api/admin/settings
    // GET /api/admin/staff
    // POST /api/admin/staff
    // DELETE /api/admin/staff/{id}
    // GET /api/admin/insights?date_from=...
  }
};

// db.js
export async function getSettings(db, tenant_id) {
  // SELECT FROM settings WHERE tenant_id = ?
}

export async function updateSettings(db, tenant_id, settings) {
  // UPDATE settings WHERE tenant_id = ? AND key = ?
  // Validate against schema.json
}
```

**Dependencies**:
- `auth.verifyPermission()` — Admin PIN only
- `booking.getBookings()` — Dashboard stats
- `pos.*` — Revenue reports

**Publishes events**:
- `settings:updated` → Notify all modules

---

### NOTIFICATIONS Module

**Purpose**: SMS, email, push, webhook delivery

**File**: `src/modules/notifications/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // POST /api/notifications/settings
    // GET /api/notifications/history
  }
};

// db.js
export async function send(db, env, tenant_id, notification) {
  // Determine channel (SMS, email, etc.)
  // Call external provider (Twilio, SendGrid)
  // Log to notifications table
}

export async function sendSMS(db, env, tenant_id, phone, message) {
  // Call Twilio API
  // Log to notifications table with status
}
```

**Dependencies**:
- `twilio` SDK (external)
- `sendgrid` SDK (external)

**Queuing**: Notifications are async (fire-and-forget). Retries via queue if failed.

---

### WEBSITE Module

**Purpose**: Public website builder, menu, booking form

**File**: `src/modules/website/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // GET /{tenant_subdomain}/
    // GET /{tenant_subdomain}/menu
    // GET /{tenant_subdomain}/booking
    // POST /{tenant_subdomain}/api/contact
  }
};

// db.js
export async function getWebsiteConfig(db, tenant_id) {
  // SELECT FROM settings WHERE tenant_id = ?
  // Filter for website keys: template, logo_url, menu_items, etc.
}
```

**Dependencies**:
- `booking.createBooking()` — Form submission → booking
- CDN for static assets (logo, images)

---

### MARKETING Module (Phase 5)

**Purpose**: Campaigns, discounts, loyalty

**File**: `src/modules/marketing/`

#### Exports

```javascript
// api.js
export default {
  async handle(request, env, tenant_id) {
    // POST /api/marketing/campaigns
    // GET /api/marketing/campaigns
    // POST /api/marketing/discount/apply
    // GET /api/loyalty/{phone}
    // POST /api/loyalty/{phone}/redeem
  }
};

// db.js
export async function createCampaign(db, tenant_id, campaign) {
  // INSERT INTO campaigns (tenant_id, ...)
}

export async function applyDiscount(db, tenant_id, phone, discountCode) {
  // Verify code against campaigns
  // Calculate discount
}
```

**Dependencies**:
- `customers.*` — Audience targeting
- `booking.*` — Trigger campaigns
- `notifications.send()` — Email/SMS campaigns

---

## Module Interaction Patterns

### Pattern 1: SyncCalls (wait for result)

```javascript
// Module A calls Module B directly
const staff = await authModule.db.getStaff(db, tenant_id, pin);
if (!staff) throw new Error('Auth failed');

// Module A uses result and continues
const bookings = await bookingModule.db.getBookings(
  db,
  tenant_id,
  date
);
```

**Use for**: Auth, data lookups, validations  
**Latency**: Must be < 200ms

---

### Pattern 2: Event Publishing (async notification)

```javascript
// Module A creates data
await bookingModule.db.createBooking(db, tenant_id, bookingData);

// Module A publishes event (non-blocking)
env.EVENT_QUEUE.send({
  type: 'booking:created',
  tenant_id,
  booking_id,
  data: bookingData
});

// Module B (notifications) subscribes via queue
// → Sends SMS to customer
// → Sends webhook to Odoo (optional, legacy)
```

**Use for**: Notifications, integrations, side effects  
**Latency**: Publishing (< 10ms), delivery (eventually consistent)

---

## Module Testing Requirements

### Unit tests (per module)

```javascript
// test/booking/db.spec.js
test('createBooking adds tenant_id', async () => {
  const booking = await bookingModule.db.createBooking(
    db,
    'tenant_1',
    { phone: '+491234567890', date: '2026-03-22', ... }
  );
  expect(booking.tenant_id).toBe('tenant_1');
});

test('getBookings filters by tenant_id', async () => {
  // Create booking for tenant_1
  // Create booking for tenant_2
  // Query tenant_1 bookings
  // Should only see tenant_1's booking
});
```

### Integration tests (cross-module)

```javascript
// test/booking/integration.spec.js
test('Booking creation triggers notification', async () => {
  const booking = await bookingModule.api.handle(
    POST /api/bookings/create with form data
  );
  
  // Verify booking created
  expect(booking.ok).toBe(true);
  
  // Verify notification queued
  const events = await getQueuedEvents('booking:created');
  expect(events).toContain(booking.booking_id);
  
  // Verify SMS would be sent (mock Twilio)
});
```

### E2E tests (full flow)

```javascript
// test/e2e/booking-to-payment.spec.js
test('Guest books → Staff confirms → Payment processed', async () => {
  // 1. Guest submits booking
  const booking = await api.POST('/api/bookings/create', { ... });
  
  // 2. Staff sees on board
  const board = await api.GET('/api/bookings?date=2026-03-22');
  expect(board.data).toContain(booking);
  
  // 3. Staff confirms
  await api.POST(`/api/bookings/${booking.id}/stage`, {
    stage: 'confirmed'
  });
  
  // 4. Customer gets SMS notification
  // (test mock Twilio)
});
```

---

## Module Migration Path

When adding new module:

1. **Stage 1**: Define contract (this file)
2. **Stage 2**: Create stub (empty db.js, api.js)
3. **Stage 3**: Implement core functionality
4. **Stage 4**: Add tests (>80% coverage)
5. **Stage 5**: Integrate with existing modules
6. **Stage 6**: Deploy to beta (1-2 restaurants)
7. **Stage 7**: GA rollout

---

## Versioning

Module versions tracked in `src/modules/{name}/VERSION`:

```
1.0.0
  - Initial release
  
1.1.0
  - Feature: Added X
  - Bug fix: Y
  
2.0.0 (breaking)
  - Changed API shape
  - Requires migration
```

**Backward compatibility**: Maintain v1 API for 6 months before removing.

---

## Module Dependencies Graph

```
Auth (core)
  ↓
├→ Booking
│    ├→ Notifications
│    └→ POS → Payment
│
├→ Admin → Booking (read)
│
├→ Website → Booking (write)
│
└→ Marketing
     ├→ Booking (read)
     └→ Notifications
```

**Rule**: No circular dependencies (enforced by linter).

---

## Contract Compliance Checklist

Before deploying new module:

- [ ] Module has own folder (src/modules/{name}/)
- [ ] Implements Module Interface (handle, db, schema)
- [ ] All DB queries filter by tenant_id
- [ ] All endpoints require tenant context
- [ ] Has >80% test coverage
- [ ] No hardcoded globals (fail-open detection)
- [ ] Errors use standard error codes
- [ ] Performance meets targets (< 1s for most)
- [ ] README documents all routes and dependencies
- [ ] Schema validates all input (JSON Schema)
- [ ] No data leaks (tenant_id isolation verified)
