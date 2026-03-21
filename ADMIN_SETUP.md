# ESSKULTUR Admin System - D1 + Staff App

## 📋 What's Ready

✅ **D1 Database Schema** (8 tables)
- `customers` - Founder profiles & activity tracking
- `bookings` - All reservations
- `booking_actions` - Audit trail
- `contacts` - Contact form submissions
- `staff` - Staff users & permissions
- `settings` - System configuration
- `otp_cache` - Temporary OTP storage
- `telegram_messages` - Message tracking

✅ **Admin UI** (4 Pages)
1. **Contacts Page** - Daily contact summary, meaningful filtering, push to Gmail
2. **Bookings Page** - List with expand, stage action buttons (Confirm/Arrived/Done/Cancel/No-Show)
3. **Customers Page** - Customer profiles, visit history, total spent, VIP/Founder badges
4. **Settings Page** - Business config + staff management

✅ **API Endpoints**
- `GET /api/bookings` - List all bookings
- `GET /api/bookings/date?date=YYYY-MM-DD` - Bookings for specific date
- `POST /api/bookings/stage` - Update booking stage
- `GET /api/customers` - List customers
- `GET /api/contacts` - New contacts
- `GET /api/settings` - System settings
- `GET /api/staff` - Active staff
- `GET /api/stats` - System statistics

## 🚀 How to Use Locally

### 1. Setup Database Locally

```bash
# Create local D1 database
wrangler d1 create esskultur-admin --local

# Initialize schema
wrangler d1 execute esskultur-admin --local --file src/db/schema.sql
```

### 2. Run Locally with Mock Data

```bash
# Start dev server
npm run dev

# Visit http://localhost:8787/admin
# Login with PIN: 1234 (Admin), 1111 (Hostess), 8888 (Manager)
```

### 3. What You'll See

- **Page 1**: Contact form summaries with quick actions
- **Page 2**: Booking list (click to expand) with stage buttons
- **Page 3**: Customer profiles with stats
- **Page 4**: Settings and staff management

## 📦 File Structure

```
src/
├── index.js              ← Main worker (serves admin UI + API)
├── db/
│   ├── schema-sql.js     ← D1 schema
│   └── init.js           ← Database initialization
└── ...

public/
├── admin.html            ← 4-page admin UI (no build needed!)
└── ...
```

## 🔗 Next Steps

1. **Push D1 schema to git** (from your other PC)
2. **Replace mock data** with real API calls to fetch from D1
3. **Add Odoo sync logic** - when stage updates, sync to Odoo
4. **Add booking form handler** - accept form submissions, create bookings
5. **Add Telegram integration** - post bookings to staff channel
6. **Add authentication** - real PIN validation via API

## 🎨 Mobile Responsive

Admin UI is fully responsive:
- ✅ Desktop: Grid layout
- ✅ Mobile: Single column, expandable rows
- ✅ Tested on 768px breakpoint

## 🔐 Authentication

Currently using **4-digit PIN**:
- `1234` - Admin
- `1111` - Hostess  
- `8888` - Manager

(Will sync with staff table in D1 once integrated)

## 📝 Notes

- Admin UI is **static HTML + vanilla JS** (no frameworks)
- All data currently mocked (replace with D1 queries)
- Stage colors match your existing system
- Fully self-contained - can deploy immediately
