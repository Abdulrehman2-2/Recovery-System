import React from 'react';
import { formatStatusLabel } from '../utils/formatters';

export function Badge({ variant = 'default', children, className = '' }) {
  const normalizedVariant = String(variant).toLowerCase().trim().replace(/\s+/g, '_');

  const variants = {
    // Red (Critical / High / Overdue / Rejected / Missed / Open / Defaulter / Dispute)
    critical: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/80 dark:text-red-200 dark:border-red-800 font-bold',
    high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 font-semibold',
    overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 font-semibold',
    missed: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/80 dark:text-red-200 dark:border-red-800 font-bold',
    open: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 font-semibold',
    rejected: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 font-semibold',
    defaulter: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/80 dark:text-red-200 dark:border-red-800 font-bold',
    dispute_raised: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 font-medium',

    // Amber (Medium / Pending / Verification / In-progress / Requested Callback)
    medium: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-medium',
    pending_verification: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-medium',
    pending: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-medium',
    partially_paid: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-medium',
    requested_callback: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-medium',

    // Green / Teal (Low / Active / Verified / Paid / Fulfilled / Resolved / Payment Promised)
    low: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium',
    active: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium',
    verified: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-semibold',
    paid: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-semibold',
    fulfilled: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-semibold',
    resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium',
    promised_payment: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium',
    payment_promise: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium',

    // Slate / Neutral (Unpaid / Cancelled / Dismissed / Unreachable / No Response / Default)
    unpaid: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dismissed: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    unreachable: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    no_response: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    default: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-medium',
  };

  const selectedClass = variants[normalizedVariant] || variants.default;
  const content = children !== undefined ? children : formatStatusLabel(variant);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs border ${selectedClass} ${className}`}
    >
      {content}
    </span>
  );
}
