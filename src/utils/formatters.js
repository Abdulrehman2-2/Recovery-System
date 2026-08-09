/**
 * Format currency values with thousand separators.
 * Example: 125000 -> "Rs. 125,000" or "$125,000"
 */
export function formatCurrency(amount, currency = 'Rs.') {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `${currency} 0`;
  }
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

/**
 * Format date string into human-readable format.
 * Example: "2026-08-09T10:30:00Z" -> "09 Aug 2026"
 */
export function formatDate(dateString, includeTime = false) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    if (!includeTime) {
      return `${day} ${month} ${year}`;
    }

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const strHours = String(hours).padStart(2, '0');

    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

/**
 * Format relative time or time only for today's logs.
 */
export function formatTime(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

/**
 * Calculates days overdue based on an invoice due date.
 * Returns 0 if not overdue yet.
 */
export function calculateDaysOverdue(dueDateString) {
  if (!dueDateString) return 0;
  try {
    const dueDate = new Date(dueDateString);
    if (isNaN(dueDate.getTime())) return 0;
    
    // Normalize both dates to midnight for exact day diff
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  } catch {
    return 0;
  }
}

/**
 * Checks if a date falls on today.
 */
export function isToday(dateString) {
  if (!dateString) return false;
  try {
    const d = new Date(dateString);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  } catch {
    return false;
  }
}
