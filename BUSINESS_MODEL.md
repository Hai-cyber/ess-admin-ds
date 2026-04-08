# Business Model — ESSKULTUR Restaurant OS

## Pricing Tiers

### Tier 1 — Core (€29/user/month)

**For restaurants starting out**

Includes:
- Managed subdomain on `gooddining.app`
- Website builder (basic templates)
- Online booking system ✅
- POS basic (table layout, simple orders)
- Payment integration (Stripe, PayPal)
- Admin UI + Staff mobile UI
- TSE optional (additional fee)

**Use case**: Single restaurant, single location, < 20 staff

---

### Tier 2 — Commerce (€69/user/month)

**For growing restaurants**

Everything in Core +
- eCommerce shop integration
- Delivery management
- Advanced booking (recurring, group bookings, waitlist)
- Marketing templates
- Discount / voucher system
- Eligible for custom-domain upgrade workflow

**Use case**: Multi-purpose venue, online sales, delivery

---

### Tier 3 — Growth (€99/user/month)

**For established restaurants**

Everything in Commerce +
- Loyalty / membership program
- Marketing automation (email campaigns, SMS)
- SEO tools
- Advanced reporting & analytics
- Priority custom-domain onboarding and operator handling

**Use case**: Popular restaurants, loyal customers, active marketing

---

### Tier 4 — Groups (Custom)

**For multi-location groups**

Everything in Repeat Guests +
- Multi-location management
- Advanced role hierarchy
- Custom integrations
- Dedicated support
- Compliance consulting
- On-premise or airgapped option (if needed)

**Use case**: Restaurant groups, complex operations

---

## Revenue Streams

### 1. Subscription (Primary - 80%)

```
Tier × # users × # months
```

Example: 10 users on Core = €29 × 10 × 12 = €3,480/year per restaurant

---

### 2. One-time Setup (5%)

- Restaurant onboarding: €99–299
- Domain setup / DNS: €49
- POS hardware configuration: €99
- Custom brand package: €199

### 2b. Domain Upgrades & Registration

- Custom-domain capability upgrade or add-on
- Managed domain registration setup
- Annual domain renewal handling fee

---

### 3. Services (10%)

- IT support / consultation: €99/hour
- UI customization: project-based
- Staff training: €99/session

---

### 4. Pass-through (5%)

- TSE fees (Fiskaly): direct cost pass-through
- Payment processing: Stripe fees (standard)
- Domain registry wholesale cost: pass-through or lightly marked up depending on support model

---

## Activation Flow (Customer journey)

```
1. Signup
   → Gmail OAuth / Email / Phone
   → Payment method (card, PayPal, bank transfer, cash/manual)

2. Create tenant
   → Auto-assign subdomain (tenant.restaurantos.app)
   → Provision D1 schema
   → Create admin user

2b. Optional later upgrade
   → Request custom-domain capability
   → Operator approves commercial upgrade
   → Tenant connects own domain or buys managed registration

3. Configure
   → Setup wizard:
     1. Restaurant info (name, address, phone)
     2. Website builder (pick template, add menu, upload logo)
     3. Connect payment (Stripe account)
     4. Add staff users (email, PIN)
     5. Configure areas (tables, zones)
     6. Set business hours

4. Enable modules
   → Activate each module based on tier:
     - Core: booking + POS + payment enabled
     - Commerce: add shop
     - Growth: add loyalty + marketing

5. Go live
   → Go live on managed subdomain first
   → Enable custom domain later if requested and verified
   → Start accepting bookings
   → Staff begins using POS

6. Support
   → Onboarding call (optional for paid tiers)
   → Email/chat support via dashboard
```

---

## Billing & Contracts

### Billing cycle

- Monthly: per user per month
- Annual: 10% discount
- Custom plans available

### Included in all tiers

- 99.9% uptime SLA
- Automatic backups
- Security updates
- Email support
- Mobile apps (iOS via web, Android APK)
- Managed subdomain hosting

### Domain Commercial Policy

- **Default**: every tenant gets a managed subdomain at no extra domain-purchase step.
- **Bring your own domain**: supported as the first upgrade path.
- **Managed registration**: optional later add-on for customers who want one invoice and less operational friction.

### Recommendation on domain resale pricing

- Do **not** try to beat Cloudflare on raw domain price.
- Selling domains at the same price as Cloudflare or only a tiny markup becomes structurally weak once support, failed renewals, tax, ownership disputes, and manual ops are included.
- Better default policy:
   - pass through registry or Cloudflare-level cost
   - add a small transparent management margin
   - keep setup / migration / DNS work as a separate service fee when needed

### Recommended commercial model

- **MVP**: bring-your-own-domain first, with a one-time DNS/domain setup fee.
- **Managed registration later**: offer domain purchase and renewal as a convenience product with small markup and bundled operator support.
- **Billing rule**: custom-domain capability and domain registration should be separate invoice lines, even if billed together.

### Pricing adjustments

- Mid-tier cancellation: no penalty
- Add/remove users: pro-rata billing
- Downgrade: effective next month

---

## Customer Acquisition Channels

1. **Direct**: Restaurant website, Google ads, restaurant industry events
2. **Partners**: POS hardware vendors (upsell), payment providers
3. **Referral**: Restaurant owner brings friend (€99 referral bonus)
4. **Integration**: List in Stripe App Marketplace, Cloudflare ecosystem

---

## Unit Economics (Projected)

| Metric | Value |
|--------|-------|
| CAC (Customer Acquisition Cost) | €300 |
| LTV (Customer Lifetime Value) | €8,700 (5-year retention) |
| LTV/CAC ratio | 29:1 |
| Payback period | ~5 months |
| Gross margin | 65% (SaaS industry standard) |

---

## Financial Forecast (Year 1)

Assumptions:
- 50 restaurants by month 12
- Avg 8 users per restaurant
- Avg tier: Core (€29) + Growth (€99) split 60/40

```
Month 1–3: €2,500 (10 restaurants)
Month 4–6: €8,000 (25 restaurants)
Month 7–9: €15,000 (40 restaurants)
Month 10–12: €22,000 (50 restaurants)

Year 1 Total: €47,500
Year 2 Target: €180,000 (120 restaurants)
```

---

## Retention & Expansion Strategy

- **NPS tracking**: Target > 50 (restaurant satisfaction)
- **Monthly check-ins**: Customer success calls, feature requests
- **Upsell**: Loyalty module for restaurants with 3+ months retention
- **Expansion revenue**: Average ticket growth €30 → €50/user over 24 months
