export function normalizeServiceDate(serviceDate, fallbackDate = '') {
  const normalized = String(serviceDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return String(fallbackDate || '').trim();
}

export function matchesServiceDate(booking, serviceDate) {
  const targetDate = normalizeServiceDate(serviceDate);
  if (!targetDate) return true;

  const bookingDate = String(booking?.booking_date || '').trim();
  if (!bookingDate) return false;
  return bookingDate === targetDate;
}

export function filterBookingsForServiceDate(bookings, serviceDate) {
  const list = Array.isArray(bookings) ? bookings : [];
  const targetDate = normalizeServiceDate(serviceDate);
  if (!targetDate) return list.slice();
  return list.filter((booking) => matchesServiceDate(booking, targetDate));
}

export function upsertBookingForServiceDate(bookings, incomingBooking, serviceDate) {
  const list = Array.isArray(bookings) ? bookings.slice() : [];
  const bookingId = String(incomingBooking?.id || '').trim();
  if (!bookingId) return list;

  const existingIndex = list.findIndex((booking) => String(booking?.id || '').trim() === bookingId);
  if (!matchesServiceDate(incomingBooking, serviceDate)) {
    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
    }
    return list;
  }

  if (existingIndex >= 0) {
    list[existingIndex] = incomingBooking;
  } else {
    list.unshift(incomingBooking);
  }

  return list;
}

export function applyStageUpdateToBookings(bookings, bookingId, newStage) {
  const list = Array.isArray(bookings) ? bookings.slice() : [];
  const normalizedBookingId = String(bookingId || '').trim();
  if (!normalizedBookingId) return list;

  const existingIndex = list.findIndex((booking) => String(booking?.id || '').trim() === normalizedBookingId);
  if (existingIndex < 0) return list;

  list[existingIndex] = {
    ...list[existingIndex],
    stage: newStage
  };
  return list;
}

export function getMinutesFromBookingTime(rawValue) {
  const match = String(rawValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

export function getArrivalsTimingBucket(booking, referenceDate = new Date()) {
  const bookingMinutes = getMinutesFromBookingTime(booking?.booking_time);
  if (bookingMinutes === null) return 'later';

  const currentMinutes = (referenceDate.getHours() * 60) + referenceDate.getMinutes();
  const delta = bookingMinutes - currentMinutes;

  if (delta < -15) return 'overdue';
  if (delta <= 15) return 'due_now';
  return 'later';
}

export function summarizeArrivalsLane(bookings, referenceDate = new Date()) {
  const confirmedItems = Array.isArray(bookings)
    ? bookings.filter((booking) => String(booking?.stage || '') === 'confirmed')
    : [];

  return confirmedItems.reduce((summary, booking) => {
    const bucket = getArrivalsTimingBucket(booking, referenceDate);
    if (bucket === 'overdue') {
      summary.overdue += 1;
    } else if (bucket === 'due_now') {
      summary.dueNow += 1;
    } else {
      summary.later += 1;
    }
    summary.total += 1;
    return summary;
  }, { total: 0, dueNow: 0, overdue: 0, later: 0 });
}

export function formatArrivalsLaneLabel(summary) {
  const totals = summary || { total: 0, dueNow: 0, overdue: 0, later: 0 };
  if (Number(totals.total || 0) <= 0) return 'No confirmed arrivals';
  if (Number(totals.overdue || 0) > 0) return `${Number(totals.dueNow || 0)} due now • ${Number(totals.overdue || 0)} overdue`;
  if (Number(totals.dueNow || 0) > 0) return `${Number(totals.dueNow || 0)} due now`;
  return `${Number(totals.later || 0)} later today`;
}

export function syncAdjacentDateBookings(adjacentDateBookings, incomingBooking, serviceDates) {
  const dates = Array.isArray(serviceDates) ? serviceDates : [];
  const nextBuckets = { ...(adjacentDateBookings || {}) };

  for (const serviceDate of dates) {
    const normalizedDate = normalizeServiceDate(serviceDate);
    if (!normalizedDate) continue;
    nextBuckets[normalizedDate] = upsertBookingForServiceDate(nextBuckets[normalizedDate], incomingBooking, normalizedDate);
  }

  return nextBuckets;
}

export const staffAppBookingHelpersScript = `window.StaffAppBookingHelpers = (() => {
  const normalizeServiceDate = ${normalizeServiceDate.toString()};
  const matchesServiceDate = ${matchesServiceDate.toString()};
  const filterBookingsForServiceDate = ${filterBookingsForServiceDate.toString()};
  const upsertBookingForServiceDate = ${upsertBookingForServiceDate.toString()};
  const applyStageUpdateToBookings = ${applyStageUpdateToBookings.toString()};
  const getMinutesFromBookingTime = ${getMinutesFromBookingTime.toString()};
  const getArrivalsTimingBucket = ${getArrivalsTimingBucket.toString()};
  const summarizeArrivalsLane = ${summarizeArrivalsLane.toString()};
  const formatArrivalsLaneLabel = ${formatArrivalsLaneLabel.toString()};
  const syncAdjacentDateBookings = ${syncAdjacentDateBookings.toString()};

  return {
    normalizeServiceDate,
    matchesServiceDate,
    filterBookingsForServiceDate,
    upsertBookingForServiceDate,
    applyStageUpdateToBookings,
    getMinutesFromBookingTime,
    getArrivalsTimingBucket,
    summarizeArrivalsLane,
    formatArrivalsLaneLabel,
    syncAdjacentDateBookings
  };
})();`;