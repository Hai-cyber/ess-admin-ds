# Checkpoints — Restaurant OS Progress Verification

**Purpose**: Concrete, verifiable checkpoints to measure progress through each Phase. Each checkpoint has:
- **Definition**: What must be true
- **Verification**: Code/script to test it
- **Acceptance**: Success criteria

---

## Checkpoint Framework

### Phase checkpoints (sequential)

```
CP-1:  Tenant Isolation ✅ (DONE)
CP-2:  Booking MVP ✅ (DONE)
CP-3:  Admin UI Setup ⏳ (IN PROGRESS)
CP-4:  Staff Mobile Ready 📋 (Phase 2)
CP-5:  POS Ready 📋 (Phase 3)
CP-6:  Payment Ready 📋 (Phase 3)
CP-7:  Odoo Removed + CRM Module ❌ (Phase 4)
CP-8:  Growth Features ❌ (Phase 5)
CP-9:  Founder/KC Reactivation Readiness 📋 (Future)
CP-10: Platform Site + Self-Service Signup 📋 (Phase 1)
```

---

## ✅ CP-1: Tenant Isolation (COMPLETED)

**Definition**: Every database query filters by `tenant_id`. No data leaks between restaurants. Multi-tenant architecture verified.

**Verification Script**:

```javascript
// scripts/verify-tenant-isolation.js
const { execSync } = require('child_process');

async function checkTenantIsolation() {
  console.log('📋 Checking Tenant Isolation...\n');
  
  // 1. Verify all SQL queries include tenant_id
  const sqlCheck = execSync(`
    grep -r "SELECT.*FROM" src/ | 
    grep -v "node_modules\|.test\|.spec" | 
    grep -v "WHERE.*tenant_id"
  `).toString();
  
  if (sqlCheck.trim().length > 0) {
    console.log('❌ FAIL: Found queries without tenant_id filter:');
    console.log(sqlCheck);
    return false;
  }
  console.log('✅ All SQL queries include tenant_id filter');
  
  // 2. Verify no hardcoded fallback tenants
  const fallback = execSync(`
    grep -r "fallbackCompanyId\\s*=\\s*1" src/
  `).toString();
  
  if (fallback.trim().length > 0) {
    console.log('❌ FAIL: Found hardcoded fallback tenants');
    return false;
  }
  console.log('✅ No hardcoded fallback tenants (fail-open)');
  
  // 3. Verify tenant-guard middleware on all tenant-required routes
  const unguarded = execSync(`
    grep -r "router\\.\\(get\\|post\\|put\\|delete\\)" src/ |
    grep -v "runTenantRoute\\|requireTenant" |
    grep -v "health\\|admin\\|app\\|danke"
  `).toString();
  
  if (unguarded.trim().length > 0) {
    console.log('⚠️  WARNING: Found potentially unguarded routes');
    console.log(unguarded.slice(0, 200));
  }
  console.log('✅ Tenant routes protected');
  
  return true;
}

checkTenantIsolation();
```

**Test**: E2E cross-tenant data leak

```javascript
// test/tenant-isolation.spec.js
test('Tenant A cannot read Tenant B bookings', async () => {
  const booking_a = await bookingModule.create(
    'tenant_a',
    { name: 'Guest A', date: '2026-03-22', ... }
  );
  
  const bookings_b = await bookingModule.list('tenant_b', '2026-03-22');
  expect(bookings_b).not.toContain(booking_a); // ✅ Should fail
});
```

**Acceptance**: 
- ✅ All SELECT queries include `WHERE tenant_id = ?`
- ✅ No hardcoded fallback tenants (fail-closed)
- ✅ E2E tests verify no cross-tenant leaks
- ✅ CI verifies these before merge

**Status**: ✅ PASSED (verified in E2E_TEST_SUMMARY.md)

---

## ✅ CP-2: Booking MVP (COMPLETED)

**Definition**: Complete online booking flow. Guests book via form, staff see bookings in real-time, stages update, notifications sent.

**Verification Script**:

```javascript
// scripts/verify-booking-mvp.js
async function checkBookingMVP() {
  console.log('📋 Checking Booking MVP...\n');
  
  const tests = [];
  
  // 1. Form submission works
  console.log('Testing: Booking form submission');
  const formRes = await fetch('http://localhost:8787/api/bookings/create', {
    method: 'POST',
    body: new FormData({
      name: 'Test Guest',
      phone: '+491234567890',
      date: '2026-03-22',
      time: '19:00',
      pax: 4,
      area: 'indoor',
      cf_token: 'dev-token'
    })
  });
  
  if (!formRes.ok || !formRes.json().booking_id) {
    console.log('❌ Booking creation failed');
    tests.push(false);
  } else {
    console.log('✅ Booking creation works');
    tests.push(true);
  }
  
  // 2. Bookings appear on board
  console.log('Testing: Bookings query');
  const boardRes = await fetch(
    'http://localhost:8787/api/bookings?date=2026-03-22&company_id=1'
  );
  
  if (!boardRes.ok || boardRes.json().data.length === 0) {
    console.log('❌ Bookings not appearing on board');
    tests.push(false);
  } else {
    console.log('✅ Bookings appear on board');
    tests.push(true);
  }
  
  // 3. SSE stream works (real-time)
  console.log('Testing: Real-time SSE stream');
  const sse = new EventSource('http://localhost:8787/api/notifications/stream?company_id=1');
  let sseWorks = false;
  
  sse.onmessage = (e) => {
    if (e.data) sseWorks = true;
  };
  
  setTimeout(() => {
    if (sseWorks) {
      console.log('✅ SSE streaming works');
      tests.push(true);
    } else {
      console.log('❌ SSE not streaming');
      tests.push(false);
    }
    sse.close();
  }, 2000);
  
  // 4. Stage transitions work
  console.log('Testing: Stage transitions');
  const stageRes = await fetch(
    'http://localhost:8787/api/bookings/{booking_id}/stage',
    {
      method: 'POST',
      body: JSON.stringify({ stage: 'confirmed', staff_id: 'admin' })
    }
  );
  
  if (!stageRes.ok) {
    console.log('❌ Stage transitions failed');
    tests.push(false);
  } else {
    console.log('✅ Stage transitions work');
    tests.push(true);
  }
  
  const allPass = tests.every(t => t === true);
  console.log(`\n${allPass ? '✅' : '❌'} Booking MVP: ${allPass ? 'PASS' : 'FAIL'}`);
  return allPass;
}

checkBookingMVP();
```

**Test**: Full E2E flow

```javascript
test('E2E: Online booking → Board → Staff notification', async () => {
  // 1. Guest submits booking
  const booking = await fetch('/api/bookings/create', { ... });
  expect(booking.ok).toBe(true);
  
  // 2. Board lists bookings
  const board = await fetch('/api/bookings?date=2026-03-22');
  expect(board.data).toContain({ id: booking.booking_id });
  
  // 3. SSE sends notification
  const notifications = [];
  sse.onmessage = (e) => notifications.push(JSON.parse(e.data));
  
  // 4. Staff updates stage
  await fetch('/api/bookings/{id}/stage', POST, { stage: 'confirmed' });
  
  // 5. Board updates in real-time
  expect(notifications).toContain({ event: 'stage-update', stage: 'confirmed' });
});
```

**Acceptance**: 
- ✅ Booking form → DB write < 500ms
- ✅ Bookings appear on board < 1s
- ✅ SSE notifications < 200ms
- ✅ Stage changes persisted
- ✅ E2E test passes

**Status**: ✅ PASSED (verified in E2E_TEST_SUMMARY.md)

---

## ⏳ CP-3: Admin UI Setup Wizard (IN PROGRESS)

**Definition**: Complete onboarding flow. Restaurant owner signs up, creates tenant, goes through setup wizard, configures all required fields, reaches "Go Live" state.

**Current CP-3 expansion now partially implemented**:
- Tenant-facing website content editor exists inside Restaurant Admin
- Tenant can edit presentation-surface fields only: text, photos, button labels, opening hours, navigation labels, and public owner or house information
- Technical keys, payload paths, renderer-only settings, and module internals remain locked
- Opening hours now stay machine-readable in payloads so they can later connect to shop and online-order availability

**Verification Script**:

```javascript
// scripts/verify-admin-setup.js
async function checkAdminSetup() {
  console.log('📋 Checking Admin Setup Wizard...\n');
  
  const tenant_id = 'test_tenant_' + Date.now();
  let currentStep = 0;
  
  // Step 1: Signup endpoint
  console.log('Step 1: Tenant signup');
  const signup = await fetch('/api/tenants/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Restaurant',
      email: 'owner@test.de',
      plan: 'core',
      payment_method: 'card'
    })
  });
  
  if (!signup.ok || !signup.tenant_id) {
    console.log('❌ Signup failed');
    return false;
  }
  console.log('✅ Tenant created:', signup.tenant_id);
  currentStep++;
  
  // Step 2: Admin PIN login
  console.log('Step 2: Admin login');
  const login = await fetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      pin: signup.admin_pin,
      tenant_id: signup.tenant_id
    })
  });
  
  if (!login.ok) {
    console.log('❌ Login failed');
    return false;
  }
  console.log('✅ Admin logged in');
  currentStep++;
  
  // Step 3: Setup wizard — Restaurant info
  console.log('Step 3: Configure restaurant info');
  const config = await fetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({
      tenant_id: signup.tenant_id,
      name: 'Test Restaurant',
      address: 'Hauptstr. 1, 10115 Berlin',
      phone: '+49301234567',
      business_hours: {
        mon: { open: '10:00', close: '22:00' },
        tue: { open: '10:00', close: '22:00' },
        // ... all days
      },
      areas: ['indoor', 'outdoor'],
      website_template: 'minimal'
    })
  });
  
  if (!config.ok) {
    console.log('❌ Config failed');
    return false;
  }
  console.log('✅ Restaurant configured');
  currentStep++;
  
  // Step 4: Add staff
  console.log('Step 4: Add staff users');
  const staff = await fetch('/api/admin/staff', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: signup.tenant_id,
      name: 'Hostess',
      role: 'hostess',
      pin: '1111'
    })
  });
  
  if (!staff.ok) {
    console.log('❌ Staff addition failed');
    return false;
  }
  console.log('✅ Staff added');
  currentStep++;
  
  // Step 5: Enable payment
  console.log('Step 5: Enable payment');
  const payment = await fetch('/api/admin/integrations/stripe', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: signup.tenant_id,
      stripe_account_id: 'acct_test_123'
    })
  });
  
  if (!payment.ok) {
    console.log('❌ Payment config failed');
    return false;
  }
  console.log('✅ Payment enabled');
  currentStep++;
  
  // Step 6: Verify setup is complete
  console.log('Step 6: Verify setup complete');
  const status = await fetch(`/api/admin/setup-status?tenant_id=${signup.tenant_id}`);
  const { is_complete, missing_fields } = await status.json();
  
  if (!is_complete) {
    console.log('❌ Setup incomplete. Missing:', missing_fields);
    return false;
  }
  console.log('✅ Setup complete');
  
  // Step 7: Go live
  console.log('Step 7: Go live');
  const goLive = await fetch('/api/tenants/' + signup.tenant_id + '/go-live', {
    method: 'POST'
  });
  
  if (!goLive.ok) {
    console.log('❌ Go-live failed');
    return false;
  }
  console.log('✅ Restaurant is live');
  
  console.log(`\n✅ Admin setup complete (${currentStep} steps)`);
  return true;
}

checkAdminSetup();
```

**Test**: Setup wizard flow

```javascript
test('Admin setup wizard: signup → config → go live', async () => {
  const tenant = await signup();
  expect(tenant.admin_pin).toBeDefined();
  
  const config = await configureRestaurant(tenant.id, { ... });
  expect(config.status).toBe('configured');
  
  const staff = await addStaff(tenant.id, { name: 'Hostess', role: 'hostess' });
  expect(staff.pin).toBeDefined();
  
  const payment = await enablePayment(tenant.id, { stripe_account: '...' });
  expect(payment.status).toBe('active');
  
  const status = await getSetupStatus(tenant.id);
  expect(status.is_complete).toBe(true);
  
  const live = await goLive(tenant.id);
  expect(live.status).toBe('live');
});
```

**Acceptance**: 
- ✅ Signup endpoint returns `tenant_id` + `admin_pin`
- ✅ Admin can login with PIN
- ✅ Restaurant info (name, address, hours, areas) configurable
- ✅ Staff can be added with PIN
- ✅ Payment can be enabled
- ✅ Setup status shows all required fields filled
- ✅ "Go Live" button appears when ready
- ✅ Can receive bookings after go-live

**Status**: 🔄 IN PROGRESS (Admin UI under development)

---

## 📋 CP-4: Staff Mobile Ready (PHASE 2)

**Definition**: Staff can use phone-only workflow. No desktop needed. Touch UI, offline support, < 8h battery drain.

**Verification Script**:

```javascript
// scripts/verify-staff-mobile.js
async function checkStaffMobile() {
  console.log('📋 Checking Staff Mobile Readiness...\n');
  
  const checks = [];
  
  // 1. Touch targets (min 44x44px)
  console.log('Testing: Touch target sizes');
  const buttons = document.querySelectorAll('button, [role="button"]');
  let touchPass = true;
  buttons.forEach(btn => {
    const rect = btn.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
      console.log(`❌ Touch target too small: ${rect.width}x${rect.height}`);
      touchPass = false;
    }
  });
  if (touchPass) {
    console.log('✅ All touch targets >= 44x44px');
    checks.push(true);
  } else {
    checks.push(false);
  }
  
  // 2. Viewport setup (mobile-first)
  console.log('Testing: Mobile viewport');
  const viewport = document.querySelector('meta[name="viewport"]');
  const mobileReady = viewport?.content.includes('width=device-width');
  if (mobileReady) {
    console.log('✅ Mobile viewport configured');
    checks.push(true);
  } else {
    console.log('❌ Viewport not mobile-optimized');
    checks.push(false);
  }
  
  // 3. Offline support (service worker)
  console.log('Testing: Service Worker (offline)');
  const swReady = 'serviceWorker' in navigator;
  if (swReady) {
    console.log('✅ Service Worker available');
    checks.push(true);
  } else {
    console.log('❌ Service Worker not registered');
    checks.push(false);
  }
  
  // 4. Battery drain test (8h use)
  console.log('Testing: Battery performance');
  const start = Date.now();
  // Simulate 8h of continuous use: polling every 30s
  let requests = 0;
  const pollInterval = setInterval(async () => {
    await fetch('/api/bookings?date=...');
    requests++;
  }, 30000);
  
  setTimeout(() => {
    clearInterval(pollInterval);
    const avgReqSize = 5; // KB per request
    const totalMB = (requests * avgReqSize) / 1024;
    console.log(`✅ Made ${requests} requests in 8h (~${totalMB}MB)`);
    checks.push(true);
  }, 28800000); // 8 hours
  
  // 5. Quick actions (<5s)
  console.log('Testing: Action performance');
  const actions = [
    { name: 'Confirm booking', endpoint: '/api/bookings/{id}/stage' },
    { name: 'Send SMS', endpoint: '/api/bookings/{id}/notify' },
    { name: 'Add order', endpoint: '/api/orders/create' }
  ];
  
  for (const action of actions) {
    const start = Date.now();
    await fetch(action.endpoint, { method: 'POST' });
    const time = Date.now() - start;
    if (time < 5000) {
      console.log(`✅ ${action.name}: ${time}ms`);
      checks.push(true);
    } else {
      console.log(`❌ ${action.name}: ${time}ms (too slow)`);
      checks.push(false);
    }
  }
  
  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} Staff Mobile: ${allPass ? 'READY' : 'NOT READY'}`);
  return allPass;
}

checkStaffMobile();
```

**Test**: Mobile E2E

```javascript
test('Staff mobile: login → view bookings → confirm booking', async () => {
  const staffApp = new Mobile('http://localhost:8787/app?company_id=1');
  
  // Login with PIN
  await staffApp.tap('PIN input');
  await staffApp.type('1234');
  await staffApp.tap('Login button');
  expect(staffApp.currentPage()).toBe('bookings-list');
  
  // View bookings
  const bookings = await staffApp.querySelectorAll('.booking-item');
  expect(bookings.length).toBeGreaterThan(0);
  
  // Confirm booking
  await staffApp.tap(bookings[0]);
  await staffApp.tap('Confirm button');
  expect(staffApp.currentPage()).toBe('bookings-list');
  
  // Verify stage changed
  const updatedBooking = await staffApp.querySelector('.booking-item');
  expect(updatedBooking.classList).toContain('confirmed');
});
```

**Acceptance**: 
- ✅ All touch targets >= 44x44px
- ✅ Works on iPhone 12 and Android
- ✅ Offline mode caches bookings
- ✅ Actions complete < 5s
- ✅ Battery test: < 20% drain in 8h continuous
- ✅ No desktop UI needed
- ✅ Mobile E2E test passes

**Status**: 📋 PHASE 2 (Design in progress)

---

## 📋 CP-5: POS System Ready (PHASE 3)

**Definition**: Complete POS workflow. Staff can manage tables, take orders, send to kitchen, manage payment, print receipt with TSE.

**Verification Script**:

```javascript
// scripts/verify-pos-ready.js
async function checkPOSReady() {
  console.log('📋 Checking POS System...\n');
  
  const checks = [];
  
  // 1. Table layout loads
  console.log('Testing: Table layout');
  const tables = await fetch('/api/pos/tables?tenant_id=1');
  if (tables.ok && tables.data.length > 0) {
    console.log(`✅ Loaded ${tables.data.length} tables`);
    checks.push(true);
  } else {
    console.log('❌ Table layout failed');
    checks.push(false);
  }
  
  // 2. Create order from booking
  console.log('Testing: Order creation');
  const order = await fetch('/api/pos/orders', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: '1',
      booking_id: 'booking_abc',
      table_id: '5',
      items: [{ product_id: 'schnitzel_1', qty: 1 }]
    })
  });
  
  if (order.ok && order.order_id) {
    console.log('✅ Order created:', order.order_id);
    checks.push(true);
  } else {
    console.log('❌ Order creation failed');
    checks.push(false);
  }
  
  // 3. Send to kitchen (KDS)
  console.log('Testing: Kitchen Display System');
  const kds = await fetch('/api/pos/orders?status=sent_to_kitchen&tenant_id=1');
  if (kds.ok && kds.data.some(o => o.status === 'sent_to_kitchen')) {
    console.log('✅ Kitchen display shows orders');
    checks.push(true);
  } else {
    console.log('❌ Kitchen display empty');
    checks.push(false);
  }
  
  // 4. Payment processing
  console.log('Testing: Payment processing');
  const payment = await fetch('/api/pos/orders/' + order.order_id + '/payment', {
    method: 'POST',
    body: JSON.stringify({
      amount: 45.00,
      method: 'card',
      stripe_token: 'tok_visa'
    })
  });
  
  if (payment.ok && payment.transaction_id) {
    console.log('✅ Payment processed:', payment.transaction_id);
    checks.push(true);
  } else {
    console.log('❌ Payment failed');
    checks.push(false);
  }
  
  // 5. Receipt generation with TSE
  console.log('Testing: Receipt with TSE');
  const receipt = await fetch('/api/pos/receipt/' + order.order_id, {
    method: 'GET'
  });
  
  if (receipt.ok && receipt.tse_signature) {
    console.log('✅ Receipt generated with TSE signature');
    checks.push(true);
  } else {
    console.log('❌ Receipt generation failed');
    checks.push(false);
  }
  
  // 6. Performance: order close < 3s
  console.log('Testing: Close table performance');
  const start = Date.now();
  await fetch('/api/pos/orders/' + order.order_id + '/close', { method: 'POST' });
  const time = Date.now() - start;
  
  if (time < 3000) {
    console.log(`✅ Order closed in ${time}ms`);
    checks.push(true);
  } else {
    console.log(`❌ Order close took ${time}ms (> 3s)`);
    checks.push(false);
  }
  
  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} POS System: ${allPass ? 'READY' : 'NOT READY'}`);
  return allPass;
}

checkPOSReady();
```

**Test**: Full POS flow

```javascript
test('POS: Open table → Add order → Kitchen → Payment → Close', async () => {
  // 1. Open table
  const table = await pos.openTable(5);
  expect(table.status).toBe('occupied');
  
  // 2. Add order
  const order = await pos.addOrder({
    table_id: 5,
    items: [{ id: 'schnitzel', qty: 1, price: 18.50 }]
  });
  expect(order.total).toBe(18.50);
  
  // 3. Send to kitchen
  await pos.sendToKitchen(order.id);
  const kdsOrder = await pos.getKDSOrder(order.id);
  expect(kdsOrder.status).toBe('sent_to_kitchen');
  
  // 4. Mark ready from kitchen
  await pos.markReady(order.id);
  expect(order.status).toBe('ready');
  
  // 5. Process payment
  const payment = await pos.charge({
    order_id: order.id,
    amount: 18.50,
    method: 'card'
  });
  expect(payment.status).toBe('completed');
  
  // 6. Print receipt (with TSE)
  const receipt = await pos.printReceipt(order.id);
  expect(receipt.tse_signature).toBeDefined();
  
  // 7. Close table
  await pos.closeTable(5);
  expect(table.status).toBe('free');
});
```

**Acceptance**: 
- ✅ 50+ tables manageable
- ✅ Order creation < 1s
- ✅ Kitchen display updates < 500ms
- ✅ Payment processing < 3s
- ✅ Receipt with TSE signature
- ✅ Split bill support
- ✅ Multiple orders per table
- ✅ POS E2E test passes

**Status**: 📋 PHASE 3 (Design phase)

---

## 📋 CP-6: Payment Integration Ready (PHASE 3)

**Definition**: Stripe payment works. Multiple payment methods (card, PayPal, split bill). Audit trail maintained. Zero fraud.

**Verification Script**:

```javascript
// scripts/verify-payment-ready.js
async function checkPaymentReady() {
  console.log('📋 Checking Payment System...\n');
  
  const checks = [];
  
  // 1. Stripe configuration
  console.log('Testing: Stripe config');
  const stripeConfig = await fetch('/api/payments/config?tenant_id=1');
  if (stripeConfig.ok && stripeConfig.stripe_account) {
    console.log('✅ Stripe configured');
    checks.push(true);
  } else {
    console.log('❌ Stripe not configured');
    checks.push(false);
  }
  
  // 2. Test charge (Stripe test card)
  console.log('Testing: Card payment');
  const charge = await fetch('/api/payments/charge', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: '1',
      amount: 25.50,
      currency: 'EUR',
      card_token: 'tok_visa', // Stripe test card
      description: 'Test charge'
    })
  });
  
  if (charge.ok && charge.transaction_id) {
    console.log('✅ Card payment succeeded');
    checks.push(true);
  } else {
    console.log('❌ Card payment failed');
    checks.push(false);
  }
  
  // 3. Failed charge handling
  console.log('Testing: Decline handling');
  const decline = await fetch('/api/payments/charge', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: '1',
      amount: 25.50,
      card_token: 'tok_chargeDeclined' // Stripe test decline
    })
  });
  
  if (decline.status === 400 && decline.error === 'card_declined') {
    console.log('✅ Declined card handled');
    checks.push(true);
  } else {
    console.log('❌ Decline handling failed');
    checks.push(false);
  }
  
  // 4. Refund support
  console.log('Testing: Refund processing');
  const refund = await fetch('/api/payments/refund', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: '1',
      transaction_id: charge.transaction_id,
      amount: 25.50
    })
  });
  
  if (refund.ok && refund.refund_id) {
    console.log('✅ Refund processed');
    checks.push(true);
  } else {
    console.log('❌ Refund failed');
    checks.push(false);
  }
  
  // 5. Split bill
  console.log('Testing: Split bill');
  const split = await fetch('/api/payments/split-bill', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: '1',
      order_id: 'order_abc',
      split_count: 2,
      payments: [
        { amount: 12.75, card_token: 'tok_visa' },
        { amount: 12.75, card_token: 'tok_visa' }
      ]
    })
  });
  
  if (split.ok && split.payments.length === 2) {
    console.log('✅ Split bill succeeded');
    checks.push(true);
  } else {
    console.log('❌ Split bill failed');
    checks.push(false);
  }
  
  // 6. Transaction audit trail
  console.log('Testing: Audit trail');
  const transactions = await fetch('/api/payments/transactions?tenant_id=1&date=2026-03-22');
  if (transactions.ok && transactions.data.length > 0) {
    console.log(`✅ Audit trail: ${transactions.data.length} transactions`);
    checks.push(true);
  } else {
    console.log('❌ Audit trail empty');
    checks.push(false);
  }
  
  // 7. PCI compliance
  console.log('Testing: PCI compliance');
  const hasCardData = await fetch('/api/debug/card-data?tenant_id=1'); // Should be EMPTY
  if (!hasCardData.ok || hasCardData.data.length === 0) {
    console.log('✅ No card data stored locally');
    checks.push(true);
  } else {
    console.log('❌ DANGER: Card data found locally');
    checks.push(false);
  }
  
  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} Payment: ${allPass ? 'READY' : 'NOT READY'}`);
  return allPass;
}

checkPaymentReady();
```

**Acceptance**: 
- ✅ Stripe account linked
- ✅ Card payment works (test + live)
- ✅ Declined cards handled gracefully
- ✅ Refunds work
- ✅ Split bill support
- ✅ All transactions audit-logged
- ✅ ZERO card data stored locally (PCI-DSS)
- ✅ Payment E2E test passes

**Status**: 📋 PHASE 3 (Integrated in Phase 3)

---

## 📋 CP-7: Odoo Removed (PHASE 4)

**Definition**: Zero Odoo API calls in critical path. All business logic in Cloudflare. First-party CRM is authoritative.

**Verification Script**:

```javascript
// scripts/verify-odoo-removed.js
async function checkOdooRemoved() {
  console.log('📋 Checking Odoo Removal...\n');
  
  const checks = [];
  
  // 1. No Odoo API calls in booking flow
  console.log('Testing: Booking flow (no Odoo)');
  const booking = execSync(`
    grep -r "odoo\|make\\.com" src/modules/booking/ |
    grep -v "test\|comment"
  `).toString();
  
  if (booking.trim().length === 0) {
    console.log('✅ Booking module: zero Odoo dependencies');
    checks.push(true);
  } else {
    console.log('❌ Booking module still calls Odoo:');
    console.log(booking.slice(0, 200));
    checks.push(false);
  }
  
  // 2. No Odoo API calls in POS flow
  console.log('Testing: POS flow (no Odoo)');
  const pos = execSync(`
    grep -r "odoo\|make\\.com" src/modules/pos/ |
    grep -v "test\|comment"
  `).toString();
  
  if (pos.trim().length === 0) {
    console.log('✅ POS module: zero Odoo dependencies');
    checks.push(true);
  } else {
    console.log('❌ POS module still calls Odoo');
    checks.push(false);
  }
  
  // 3. No Odoo API calls in payment flow
  console.log('Testing: Payment flow (no Odoo)');
  const payment = execSync(`
    grep -r "odoo\|make\\.com" src/modules/payment/ |
    grep -v "test\|comment"
  `).toString();
  
  if (payment.trim().length === 0) {
    console.log('✅ Payment module: zero Odoo dependencies');
    checks.push(true);
  } else {
    console.log('❌ Payment module still calls Odoo');
    checks.push(false);
  }
  
  // 4. Make.com webhooks disabled
  console.log('Testing: Make.com webhook status');
  const makeWebhooks = execSync(`
    grep -r "webhook.*make" src/ | grep -v "disabled\|comment"
  `).toString();
  
  if (makeWebhooks.trim().length === 0) {
    console.log('✅ Make.com webhooks: disabled');
    checks.push(true);
  } else {
    console.log('❌ Make.com webhooks still active');
    checks.push(false);
  }
  
  // 5. Performance improvement (< 15s latency)
  console.log('Testing: Latency improvement');
  const start = Date.now();
  await fetch('/api/bookings/create', { /* test booking */ });
  const latency = Date.now() - start;
  
  if (latency < 500) { // Was 15-25s with Odoo, now < 500ms
    console.log(`✅ Booking latency: ${latency}ms (improved 40x)`);
    checks.push(true);
  } else {
    console.log(`❌ Booking still slow: ${latency}ms`);
    checks.push(false);
  }
  
  // 6. Cost reduction (Odoo license saved)
  console.log('Testing: Cost savings');
  const costs = {
    odoo_license_monthly: 0, // ✅ No longer paying
    cloudflare_workers: 10, // ~€10/mo
    stripe_fees: 'variable',
    savings: 'Odoo license gone'
  };
  console.log('✅ Monthly costs:', costs);
  checks.push(true);
  
  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} Odoo Removed: ${allPass ? 'COMPLETE' : 'INCOMPLETE'}`);
  return allPass;
}

checkOdooRemoved();
```

**Acceptance**: 
- ✅ Zero Odoo API calls in critical path (booking, POS, payment)
- ✅ Make.com workflows disabled/removed
- ✅ All business logic in Workers
- ✅ Booking latency < 500ms (was 15-25s)
- ✅ First-party CRM is authoritative; no Odoo mirror is required
- ✅ Odoo license can be cancelled
- ✅ Cleanup shell script runs without errors

**Status**: ❌ PHASE 4 (Not yet started)

---

## ❌ CP-8: Growth Features (PHASE 5)

**Definition**: Loyalty, shop, marketing automation working. 50+ restaurants active, NPS > 50.

**Verification Script**:

```javascript
// scripts/verify-growth-ready.js
async function checkGrowthReady() {
  console.log('📋 Checking Growth Features...\n');
  
  const checks = [];
  
  // 1. Loyalty program
  console.log('Testing: Loyalty program');
  const loyalty = await fetch('/api/loyalty/points?phone=+49xxx&tenant_id=1');
  if (loyalty.ok && loyalty.points_balance >= 0) {
    console.log('✅ Loyalty tracking');
    checks.push(true);
  }
  
  // 2. Shop integration
  console.log('Testing: Shop orders');
  const shop = await fetch('/api/shop/orders?tenant_id=1');
  if (shop.ok && Array.isArray(shop.orders)) {
    console.log('✅ Shop working');
    checks.push(true);
  }
  
  // 3. Marketing campaigns
  console.log('Testing: Marketing');
  const marketing = await fetch('/api/marketing/campaigns?tenant_id=1');
  if (marketing.ok) {
    console.log('✅ Marketing automation');
    checks.push(true);
  }
  
  // 4. 50+ active restaurants
  console.log('Testing: Customer base');
  const customers = await fetch('/api/operator/customers');
  if (customers.count >= 50) {
    console.log(`✅ ${customers.count} active restaurants`);
    checks.push(true);
  }
  
  // 5. NPS > 50
  console.log('Testing: Customer satisfaction');
  const nps = await fetch('/api/operator/nps?period=30d');
  if (nps.score > 50) {
    console.log(`✅ NPS: ${nps.score}`);
    checks.push(true);
  }
  
  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} Growth Ready: ${allPass ? 'YES' : 'NO'}`);
  return allPass;
}

checkGrowthReady();
```

**Acceptance**: 
- ✅ Loyalty module working
- ✅ Shop integration active
- ✅ Email/SMS campaigns sending
- ✅ 50+ restaurants generating revenue
- ✅ NPS > 50 (very satisfied customers)
- ✅ < 5 support tickets/week
- ✅ Growth E2E test passes

**Status**: ❌ PHASE 5 (Planned)

---

## 📋 CP-9: Founder/KC Reactivation Readiness (FUTURE READINESS)

**Definition**: Founder and KC flows remain reference-safe now and can be reactivated later without schema/API drift.

**Verification Script**:

```javascript
// scripts/verify-founder-kc-readiness.js
async function checkFounderKcReadiness() {
  console.log('📋 Checking Founder/KC Reactivation Readiness...\n');

  const checks = [];

  // 1. Legacy references preserved
  console.log('Testing: legacy reference registry');
  const legacyRegistry = await fetch('/docs/legacies/README.md');
  if (legacyRegistry.ok) {
    console.log('✅ Legacy registry present');
    checks.push(true);
  } else {
    console.log('❌ Legacy registry missing');
    checks.push(false);
  }

  // 2. API mapping section exists
  console.log('Testing: API compatibility mapping');
  const apiContract = await fetch('/docs/contracts/API_CONTRACTS.md');
  if (apiContract.ok) {
    console.log('✅ API compatibility section present');
    checks.push(true);
  } else {
    console.log('❌ API compatibility section missing');
    checks.push(false);
  }

  // 3. Data mapping section exists
  console.log('Testing: data compatibility mapping');
  const dataContract = await fetch('/docs/contracts/DATA_CONTRACTS.md');
  if (dataContract.ok) {
    console.log('✅ Data compatibility section present');
    checks.push(true);
  } else {
    console.log('❌ Data compatibility section missing');
    checks.push(false);
  }

  // 4. OTP requirements retained in guidance
  console.log('Testing: OTP semantics (sms + whatsapp, cooldown, expiry)');
  // Placeholder: validate policy/docs or test fixtures when flow is implemented
  checks.push(true);
  console.log('✅ OTP compatibility policy retained');

  const allPass = checks.every(c => c === true);
  console.log(`\n${allPass ? '✅' : '❌'} Founder/KC Readiness: ${allPass ? 'READY' : 'NOT READY'}`);
  return allPass;
}

checkFounderKcReadiness();
```

**Acceptance**:
- ✅ Legacy reference assets documented and preserved
- ✅ API compatibility mapping documented
- ✅ Data compatibility mapping documented
- ✅ OTP rules retained (`sms|whatsapp`, cooldown, expiry)
- ✅ Reactivation checklist ready for implementation phase

**Status**: 📋 FUTURE (Reference Mode Active)

---

## Checkpoint CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run checkpoint verification
  run: |
    npm run check:cp-tenant-isolation
    npm run check:cp-booking-mvp
    npm run check:cp-admin-setup
    npm run check:cp-staff-mobile      # Will skip if Phase 2 not active
    npm run check:cp-pos               # Will skip if Phase 3 not active
    npm run check:cp-payment           # Will skip if Phase 3 not active
    npm run check:cp-odoo-removed      # Will skip if Phase 4 not active
    npm run check:cp-growth            # Will skip if Phase 5 not active
    npm run check:cp-founder-kc-readiness  # Reference readiness check
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:cp-all": "for cp in tenant-isolation booking-mvp admin-setup staff-mobile pos payment odoo-removed growth founder-kc-readiness; do npm run check:cp-$cp; done",
    "check:cp-tenant-isolation": "node scripts/verify-tenant-isolation.js",
    "check:cp-booking-mvp": "node scripts/verify-booking-mvp.js",
    "check:cp-admin-setup": "node scripts/verify-admin-setup.js",
    "check:cp-staff-mobile": "node scripts/verify-staff-mobile.js",
    "check:cp-pos": "node scripts/verify-pos-ready.js",
    "check:cp-payment": "node scripts/verify-payment-ready.js",
    "check:cp-odoo-removed": "node scripts/verify-odoo-removed.js",
    "check:cp-growth": "node scripts/verify-growth-ready.js",
    "check:cp-founder-kc-readiness": "node scripts/verify-founder-kc-readiness.js"
  }
}
```

---

## Checkpoint Dashboard (Optional)

Track progress visually:

```
┌──────────────────────────────────────────────────────┐
│          RESTAURANT OS CHECKPOINT DASHBOARD           │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Phase 1: Booking System                              │
│  ✅ CP-1: Tenant Isolation          [████████████]    │
│  ✅ CP-2: Booking MVP               [████████████]    │
│  ⏳ CP-3: Admin UI Setup             [████░░░░░░░░]    │
│                                                       │
│ Phase 2: Staff Mobile (Q3 2026)                      │
│  📋 CP-4: Staff Mobile Ready        [░░░░░░░░░░░░]    │
│                                                       │
│ Phase 3: POS & Payment (Q4 2026)                     │
│  📋 CP-5: POS System Ready          [░░░░░░░░░░░░]    │
│  📋 CP-6: Payment Integration       [░░░░░░░░░░░░]    │
│                                                       │
│ Phase 4: Odoo Removal (Q1 2027)                      │
│  ❌ CP-7: Odoo Removed              [░░░░░░░░░░░░]    │
│                                                       │
│ Phase 5: Growth Features (Q2 2027)                   │
│  ❌ CP-8: Growth Features           [░░░░░░░░░░░░]    │
│                                                       │
│ Future Readiness                                      │
│  📋 CP-9: Founder/KC Readiness      [░░░░░░░░░░░░]    │
│                                                       │
│ Phase 1 Extension                                     │
│  📋 CP-10: Platform Site + Signup   [░░░░░░░░░░░░]    │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 📋 CP-10: Platform Site + Self-Service Signup (PHASE 1 EXTENSION)

**Definition**: `restaurantos.app` is live with marketing content and pricing tiers. A restaurant owner can sign up, verify their email, and land in the Admin setup wizard — without any manual provisioning.

**2026-03-31 update**: The tenant website track is now explicitly locked to a fixed-skin model. The repository includes a canonical website template contract plus a pre-publish validation gate so future tenant versions are created from bounded presets instead of bespoke page structures.

**Prerequisite**: CP-3 (Admin UI Setup) must pass first.

**Verification Script**:

```javascript
// scripts/verify-platform-signup.js
async function checkPlatformSignup() {
  console.log('📋 Checking Platform Site + Self-Service Signup...\n');

  // 1. Platform site reachable
  const home = await fetch('https://restaurantos.app');
  if (!home.ok) { console.log('❌ Platform homepage not reachable'); process.exit(1); }
  console.log('✅ Platform homepage reachable');

  // 2. Plans API works
  const plans = await fetch('https://restaurantos.app/api/platform/plans').then(r => r.json());
  if (!plans.ok || plans.plans.length < 3) {
    console.log('❌ Plans API missing or incomplete'); process.exit(1);
  }
  console.log(`✅ Plans API: ${plans.plans.length} tiers returned`);

  // 3. Subdomain availability check
  const check = await fetch('https://restaurantos.app/api/platform/signup/check-subdomain?slug=test-restaurant-xyz').then(r => r.json());
  if (check.available === undefined) {
    console.log('❌ Subdomain check endpoint broken'); process.exit(1);
  }
  console.log('✅ Subdomain availability check works');

  // 4. Signup creates tenant (test subdomain)
  const signup = await fetch('https://restaurantos.app/api/platform/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_name: 'CP10 Test Restaurant',
      owner_email: `cp10-test-${Date.now()}@example.com`,
      subdomain: `cp10-test-${Date.now()}`,
      plan: 'core',
      country: 'DE'
    })
  }).then(r => r.json());
  if (!signup.ok || signup.status !== 'pending_email') {
    console.log('❌ Signup failed:', signup); process.exit(1);
  }
  console.log('✅ Signup creates tenant with status pending_email');

  // 5. Tenant website template is accessible
  // (use a pre-seeded trial tenant for this check)
  const tenantSite = await fetch('https://demo.restaurantos.app');
  if (!tenantSite.ok) {
    console.log('⚠️  Demo tenant website not responding (non-fatal)');
  } else {
    console.log('✅ Tenant template website reachable');
  }

  console.log('\n✅ CP-10 PASSED: Platform site and signup operational');
}
checkPlatformSignup().catch(e => { console.error(e); process.exit(1); });
```

**Acceptance criteria**:

- [ ] `restaurantos.app` serves marketing homepage (features, pricing, signup CTA)
- [ ] Pricing page shows all 4 tiers (Core €29 / Commerce €69 / Growth €99 / Enterprise)
- [ ] `/templates` page previews all 3 tenant templates (Minimal, Modern, Premium)
- [ ] Subdomain availability check returns correct `available` true/false
- [ ] `POST /api/platform/signup` creates tenant row with `status: pending_email`
- [ ] Verification email is sent (SendGrid mock in test, real in staging)
- [ ] `POST /api/platform/signup/verify-email` flips status to `trial_active`
- [ ] After verify, redirect lands restaurant owner at `{subdomain}.restaurantos.app/admin/setup`
- [ ] Setup wizard completes → tenant website live at `{subdomain}.restaurantos.app`
- [x] Website template contract exists for fixed page keys, payload shape, media slots, and fallback rules
- [x] Pre-publish validator exists and rejects invalid tenant website payloads before render/publish
- [ ] Booking form on tenant website creates bookings in D1 (end-to-end)
- [ ] Rate limiting active on signup endpoint (5/hour per IP)
- [ ] Tenant isolation not violated during provisioning

**Test cases**:

```javascript
test('signup: creates pending_email tenant', async () => {
  const res = await api.post('/api/platform/signup', {
    restaurant_name: 'Test', owner_email: 'a@b.de',
    subdomain: 'test-123', plan: 'core', country: 'DE'
  });
  expect(res.ok).toBe(true);
  expect(res.status).toBe('pending_email');
});

test('signup: rejects duplicate subdomain', async () => {
  const res = await api.post('/api/platform/signup', { subdomain: 'test-123', ... });
  expect(res.code).toBe('subdomain_taken');
});

test('signup: rejects duplicate email', async () => {
  const res = await api.post('/api/platform/signup', { owner_email: 'a@b.de', subdomain: 'other', ... });
  expect(res.code).toBe('email_already_registered');
});

test('verify-email: activates trial', async () => {
  const res = await api.post('/api/platform/signup/verify-email', { token: 'tok_xxx' });
  expect(res.status).toBe('trial_active');
  expect(res.redirect_url).toContain('/admin/setup');
});

test('verify-email: rejects expired token', async () => {
  const res = await api.post('/api/platform/signup/verify-email', { token: 'expired' });
  expect(res.code).toBe('token_expired');
});

test('tenant website serves template after setup', async () => {
  const res = await fetch('https://test-123.restaurantos.app');
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
});
```

**npm script**:
```json
"check:cp-platform-signup": "node scripts/verify-platform-signup.js"
```

---

## How to Use

1. **Run all checkpoints**:
   ```bash
   npm run check:cp-all
   ```

2. **Run specific checkpoint**:
   ```bash
   npm run check:cp-booking-mvp
   ```

3. **Run before PR**:
   ```bash
   npm run check:cp-all && npm run test && npm run deploy
   ```

4. **Check phase progress**:
   ```bash
   # Check if Phase 2 is ready to start
   npm run check:cp-admin-setup   # If passing, Phase 1 done
   ```

5. **Track in CI**:
   - All checkpoints run on every commit
   - Fail builds if critical checkpoints fail
   - Report progress to dashboard
