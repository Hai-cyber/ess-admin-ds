# SSE Architecture

## Overview

Server-Sent Events stream booking and stage-update notifications per company in real-time. Isolation is by `company_id` channel.

## Connection Lifecycle

```
1. Client connects to GET /api/notifications/stream
   ├─ Guard validates tenant resolution
   ├─ query ?company_id=N allowed on localhost/workers.dev only
   └─ companyId determined from subdomain or query

2. Stream opens with ReadableStream
   ├─ Event: "connected" { ok: true }
   ├─ Keepalive ping every 30s (`:` heartbeat)
   └─ Waits for booking/stage-update events

3. Upon event, send to all clients in company channel:
   ├─ Event: "booking" { id, contact_name, phone, pax, booking_date, booking_time, area, stage }
   ├─ Event: "stage-update" { id, stage, staffId, updatedAt }
   └─ Sent to sseClients.get(companyId) only

4. Client closes or network error
   └─ Cleanup on next keepalive attempt
```

## Storage

```js
// Global state per Worker instance
const sseClients = new Map();
// sseClients: { companyId => Set<{ id, send(event, data) }> }
```

**Per-company isolation:** Each company stream is separate; events never cross.

## Event Types

### `connected`

Sent when client first connects.

```json
{
  "event": "connected",
  "data": { "ok": true }
}
```

### `booking`

Sent when new booking created via `/api/bookings/create`.

```json
{
  "event": "booking",
  "data": {
    "id": "booking_1_1234567890",
    "contact_name": "John Doe",
    "phone": "+491234567890",
    "email": "john@example.com",
    "guests_pax": 4,
    "booking_date": "2026-04-15",
    "booking_time": "19:00",
    "area": "indoor",
    "stage": "pending"
  }
}
```

### `stage-update`

Sent when booking stage updated via `/api/bookings/:id/stage`.

```json
{
  "event": "stage-update",
  "data": {
    "id": "booking_1_1234567890",
    "stage": "confirmed",
    "staffId": "staff_1",
    "updatedAt": "2026-03-19T15:30:00Z"
  }
}
```

## Code Reference

- **Stream handler**: [src/index.js:2724-2789](../../src/index.js#L2724)
- **Booking event send**: [src/index.js:2856-2872](../../src/index.js#L2856)
- **Stage event send**: [src/index.js:2954-2970](../../src/index.js#L2954)

## Timeout & Reliability

- **Keepalive interval**: 30 seconds (`:` heartbeat)
- **Client timeout assumption**: 90+ seconds (typical browser SSE)
- **Graceful disconnect**: On read/encode error, client removed from set
- **No persistence**: Events not stored; only for active connections

## Testing

See [docs/contracts/tests.md](tests.md) for SSE isolation test cases.
