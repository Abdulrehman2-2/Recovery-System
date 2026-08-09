/**
 * Standard currency formatter with comma separation and fallback.
 * Example: 125000 -> "Rs. 125,000"
 */
export function formatCurrency(amount, currency = 'Rs.') {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `${currency} 0`;
  }
  const num = Number(amount);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

/**
 * Returns a clean Date object stripped of time (local midnight 00:00:00.000).
 * Supports YYYY-MM-DD strings and ISO timestamps without UTC timezone drift.
 */
export function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  try {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const parts = dateInput.substring(0, 10).split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 0, 0, 0, 0);
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  } catch {
    return null;
  }
}

/**
 * Returns today's date normalized to local midnight.
 */
export function getTodayMidnight() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
}

/**
 * Calculates exact integer days overdue based on an invoice due date.
 * Strips time components before calculating.
 * If due date is 7th Aug and today is 8th Aug -> 1 day overdue.
 * Returns 0 if due date is today or in the future.
 */
export function calculateDaysOverdue(dueDateString) {
  if (!dueDateString) return 0;
  const dueDate = parseDateOnly(dueDateString);
  if (!dueDate) return 0;

  const today = getTodayMidnight();
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Formats overdue days into clean, grammatically correct text.
 * Example: 0 -> "Not yet due", 1 -> "1 day overdue", 5 -> "5 days overdue"
 */
export function formatOverdueDays(days) {
  const d = Number(days) || 0;
  if (d <= 0) return 'Not yet due';
  if (d === 1) return '1 day overdue';
  return `${d} days overdue`;
}

/**
 * Formats date into readable string: "09 Aug 2026"
 * Handles null / undefined / invalid values gracefully.
 */
export function formatDate(dateString, includeTime = false) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    if (!includeTime) {
      return `${day} ${month} ${year}`;
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');

    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

/**
 * Formats time string: "11:30 AM"
 */
export function formatTime(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

/**
 * Formats last contacted date or displays "Never contacted" when null.
 */
export function formatLastContacted(dateString) {
  if (!dateString) return 'Never contacted';
  const formatted = formatDate(dateString);
  return formatted === '—' ? 'Never contacted' : formatted;
}

/**
 * Standard pluralization helper.
 * Example: pluralize(1, 'Log') -> "1 Log", pluralize(3, 'Log') -> "3 Logs"
 */
export function pluralize(count, singular, plural = `${singular}s`) {
  const c = Number(count) || 0;
  return `${c} ${c === 1 ? singular : plural}`;
}

/**
 * Checks if a promise is broken/missed:
 * status === 'missed' OR (status === 'pending' and promised_date is strictly in the past)
 */
export function isPromiseBroken(promise) {
  if (!promise) return false;
  if (promise.status === 'missed') return true;
  if (promise.status === 'pending' && promise.promised_date) {
    const promisedDate = parseDateOnly(promise.promised_date);
    const today = getTodayMidnight();
    if (promisedDate && promisedDate.getTime() < today.getTime()) {
      return true;
    }
  }
  return false;
}

/**
 * Formats status strings to clean, human-readable titles.
 * Example: "pending_verification" -> "Pending Verification"
 */
export function formatStatusLabel(status) {
  if (!status) return '—';
  const labelMap = {
    pending_verification: 'Pending Verification',
    verified: 'Verified',
    rejected: 'Rejected',
    paid: 'Paid',
    unpaid: 'Unpaid',
    overdue: 'Overdue',
    partially_paid: 'Partially Paid',
    pending: 'Pending',
    fulfilled: 'Fulfilled',
    missed: 'Missed',
    cancelled: 'Cancelled',
    open: 'Open',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
    active: 'Active',
    defaulter: 'Defaulter',
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    promised_payment: 'Payment Promised',
    payment_promise: 'Payment Promised',
    dispute_raised: 'Dispute Raised',
    requested_callback: 'Requested Callback',
    no_response: 'No Response',
    unreachable: 'Unreachable',
  };
  const key = String(status).toLowerCase().trim().replace(/\s+/g, '_');
  if (labelMap[key]) return labelMap[key];

  // Capitalize words as fallback
  return String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
