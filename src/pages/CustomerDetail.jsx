import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  Receipt,
  FileText,
  PhoneCall,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../supabase';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import {
  formatCurrency,
  formatDate,
  calculateDaysOverdue,
  formatOverdueDays,
  formatLastContacted,
  pluralize,
  isPromiseBroken,
} from '../utils/formatters';
import { useNotifications } from '../context/NotificationContext';

export function CustomerDetail() {
  const { id } = useParams();
  const { refreshNotifications } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Customer profile data
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [promises, setPromises] = useState([]);
  const [payments, setPayments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [flags, setFlags] = useState([]);

  // Expanded Conversation ID (shows summary only)
  const [expandedConvId, setExpandedConvId] = useState(null);

  // Payment Verification State
  const [rejectingPaymentId, setRejectingPaymentId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  const fetchCustomerDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Customer Record
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (custErr) throw custErr;
      if (!custData) throw new Error('Customer account not found.');

      // 2. Fetch Invoices
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', id)
        .order('due_date', { ascending: false });

      if (invErr) console.warn('Invoices fetch error:', invErr.message);

      // 3. Fetch Payment Promises
      const { data: promData, error: promErr } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('customer_id', id)
        .order('promised_date', { ascending: false });

      if (promErr) console.warn('Promises fetch error:', promErr.message);

      // 4. Fetch Payments
      const { data: payData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', id)
        .order('submitted_at', { ascending: false });

      if (payErr) console.warn('Payments fetch error:', payErr.message);

      // 5. Fetch Conversations (Summary only, no chat messages)
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('id, customer_id, started_at, outcome, summary, created_at')
        .eq('customer_id', id)
        .order('started_at', { ascending: false });

      if (convErr) console.warn('Conversations fetch error:', convErr.message);

      // 6. Fetch Flags
      const { data: flagData, error: flagErr } = await supabase
        .from('flags')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (flagErr) console.warn('Flags fetch error:', flagErr.message);

      setCustomer(custData);
      setInvoices(invData || []);
      setPromises(promData || []);
      setPayments(payData || []);
      setConversations(convData || []);
      setFlags(flagData || []);

      // Auto-expand first conversation by default if available
      if (convData && convData.length > 0) {
        setExpandedConvId((prev) => prev || convData[0].id);
      }
    } catch (err) {
      console.error('Failed to load customer profile:', err);
      setError(err.message || 'Failed to fetch customer profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomerDetails();
  }, [fetchCustomerDetails]);

  // Toggle Conversation Card Expansion (Summary Only)
  const handleToggleConversation = (convId) => {
    setExpandedConvId((prev) => (prev === convId ? null : convId));
  };

  // Approve Payment Action
  const handleApprovePayment = async (paymentId, amount) => {
    try {
      setActionProcessing(true);
      const verifiedAt = new Date().toISOString();

      // 1. Update payment status in Supabase
      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'verified',
          verified_at: verifiedAt,
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      // 2. Immediately reduce customer's total_outstanding in database & state
      const numAmount = Number(amount) || 0;
      const currentOutstanding = Number(customer?.total_outstanding) || 0;
      const newOutstanding = Math.max(0, currentOutstanding - numAmount);

      await supabase
        .from('customers')
        .update({ total_outstanding: newOutstanding })
        .eq('id', id);

      // Update local state immediately for instant feedback
      setCustomer((prev) => ({
        ...prev,
        total_outstanding: newOutstanding,
      }));

      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, status: 'verified', verified_at: verifiedAt }
            : p
        )
      );

      setActionSuccessMessage(`Payment of ${formatCurrency(amount)} has been approved and verified.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);

      // Refresh global notifications & reload
      refreshNotifications();
      await fetchCustomerDetails();
    } catch (err) {
      console.error('Failed to approve payment:', err);
      alert('Error approving payment: ' + err.message);
    } finally {
      setActionProcessing(false);
    }
  };

  // Reject Payment Action
  const handleConfirmRejectPayment = async (paymentId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a specific reason for rejecting this payment proof.');
      return;
    }

    try {
      setActionProcessing(true);
      const reasonText = rejectionReason.trim();

      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          rejection_reason: reasonText,
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      // Update local payments state immediately
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, status: 'rejected', rejection_reason: reasonText }
            : p
        )
      );

      setRejectingPaymentId(null);
      setRejectionReason('');
      setActionSuccessMessage('Payment has been rejected and reason recorded.');
      setTimeout(() => setActionSuccessMessage(null), 4000);

      // Refresh global notifications & reload
      refreshNotifications();
      await fetchCustomerDetails();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      alert('Error rejecting payment: ' + err.message);
    } finally {
      setActionProcessing(false);
    }
  };

  // Resolve Flag Action
  const handleResolveFlag = async (flagId) => {
    try {
      setActionProcessing(true);
      const { error: flagErr } = await supabase
        .from('flags')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', flagId);

      if (flagErr) throw flagErr;

      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, status: 'resolved' } : f))
      );

      setActionSuccessMessage('Urgent flag marked as resolved.');
      setTimeout(() => setActionSuccessMessage(null), 4000);

      refreshNotifications();
      await fetchCustomerDetails();
    } catch (err) {
      console.error('Error resolving flag:', err);
      alert('Failed to resolve flag: ' + err.message);
    } finally {
      setActionProcessing(false);
    }
  };

  // Earliest Unpaid Due Date and Days Overdue Math
  const earliestUnpaidDueDate = useMemo(() => {
    const unpaidInvoices = invoices.filter((i) => i.status !== 'paid' && i.due_date);
    if (unpaidInvoices.length === 0) return null;

    return unpaidInvoices.reduce((earliest, curr) => {
      if (!earliest) return curr.due_date;
      return new Date(curr.due_date) < new Date(earliest) ? curr.due_date : earliest;
    }, null);
  }, [invoices]);

  const daysOverdue = useMemo(() => {
    return earliestUnpaidDueDate ? calculateDaysOverdue(earliestUnpaidDueDate) : 0;
  }, [earliestUnpaidDueDate]);

  // Broken promises count using standardized logic
  const brokenPromisesCount = useMemo(() => {
    return promises.filter(isPromiseBroken).length;
  }, [promises]);

  const openFlags = useMemo(() => {
    return flags.filter((f) => f.status === 'open');
  }, [flags]);

  if (loading && !customer) {
    return <LoadingSpinner message="Loading customer account details..." />;
  }

  if (error || !customer) {
    return (
      <div className="space-y-4 pb-12">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal dark:text-mint"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
        <ErrorMessage
          message={error || 'Customer account not found'}
          onRetry={fetchCustomerDetails}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md hover:bg-slate-50 dark:hover:bg-navy-700 shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Customers
        </Link>

        <button
          onClick={fetchCustomerDetails}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md shadow-sm transition"
          title="Refresh Customer Details"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success Alert Banner */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between text-emerald-900 dark:text-emerald-200 text-xs font-semibold shadow-sm animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {actionSuccessMessage}
          </div>
          <button onClick={() => setActionSuccessMessage(null)}>
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      )}

      {/* Urgent Open Flags Alert Banner */}
      {openFlags.length > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-l-rose-600 border border-rose-200 dark:border-rose-900 rounded-r-lg space-y-2">
          {openFlags.map((flag) => (
            <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                    [URGENT FLAG]
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5 font-medium">
                    {flag.reason}
                  </p>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 block">
                    Raised on {formatDate(flag.created_at, true)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleResolveFlag(flag.id)}
                disabled={actionProcessing}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-sm transition self-start sm:self-auto disabled:opacity-50"
              >
                Resolve Flag
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Customer Header Info Card */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-50 dark:bg-navy-900 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal dark:text-mint shrink-0">
              <Store className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {customer.shop_name || 'Customer Profile'}
                </h1>
                {customer.status && (
                  <Badge variant={customer.status} className="uppercase font-bold">
                    {customer.status}
                  </Badge>
                )}
                {customer.priority && (
                  <Badge variant={customer.priority} className="uppercase font-bold">
                    {customer.priority}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {customer.owner_name || 'No Owner Listed'}
                </span>

                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-teal dark:text-mint font-semibold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </a>
                )}

                {customer.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {customer.city}
                  </span>
                )}

                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  Last contacted: {formatLastContacted(customer.last_contacted_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary Stat Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Outstanding */}
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(customer.total_outstanding)}
          subtitle={pluralize(invoices.filter((i) => i.status !== 'paid').length, 'unpaid invoice')}
          icon={DollarSign}
          color="navy"
        />

        {/* 2. Days Overdue */}
        <StatCard
          title="Days Overdue"
          value={formatOverdueDays(daysOverdue)}
          subtitle={
            earliestUnpaidDueDate
              ? `Earliest due date: ${formatDate(earliestUnpaidDueDate)}`
              : 'All invoices settled'
          }
          icon={Calendar}
          color={daysOverdue > 30 ? 'rose' : daysOverdue > 0 ? 'rose' : 'teal'}
          badge={daysOverdue > 30 ? 'High Risk' : daysOverdue > 0 ? 'Past Due' : 'On Track'}
          badgeVariant={daysOverdue > 0 ? 'overdue' : 'paid'}
        />

        {/* 3. Follow-up Count */}
        <StatCard
          title="Follow-up Count"
          value={customer.follow_up_count || conversations.length}
          subtitle={pluralize(conversations.length, 'call session logged', 'call sessions logged')}
          icon={PhoneCall}
          color="blue"
        />

        {/* 4. Broken Promises */}
        <StatCard
          title="Broken Promises"
          value={brokenPromisesCount}
          subtitle={
            brokenPromisesCount > 0
              ? 'Missed agreed payment dates'
              : 'No missed promises'
          }
          icon={AlertTriangle}
          color={brokenPromisesCount > 0 ? 'rose' : 'emerald'}
          badge={brokenPromisesCount > 0 ? 'Defaulter Risk' : 'Reliable'}
          badgeVariant={brokenPromisesCount > 0 ? 'missed' : 'fulfilled'}
        />
      </div>

      {/* SECTION 1: Calls / Conversations (Summary Only - Chat bubbles removed per spec) */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Calls & Conversations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log of automated and agent follow-up calls with executive summaries.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {pluralize(conversations.length, 'Call')}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No calls logged for this customer"
              description="When follow-up calls or automated recovery calls take place, call dates, outcomes, and summaries will appear here."
              icon={PhoneCall}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {conversations.map((conv) => {
              const isExpanded = expandedConvId === conv.id;

              return (
                <div key={conv.id} className="transition">
                  {/* Conversation Row Header */}
                  <div
                    onClick={() => handleToggleConversation(conv.id)}
                    className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-navy-700/50 ${
                      isExpanded ? 'bg-teal-50/30 dark:bg-navy-700/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-mint shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Call on {formatDate(conv.started_at, true)}
                          </span>
                          {conv.outcome && (
                            <Badge variant={conv.outcome} className="text-[10px]" />
                          )}
                        </div>
                        {conv.summary && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                            {conv.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-teal dark:text-mint flex items-center gap-1">
                        {isExpanded ? 'Collapse' : 'Expand'}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Conversation: Call Summary Only */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700">
                      <div className="p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Call Summary & Action Items:
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Logged on {formatDate(conv.started_at, true)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {conv.summary || 'No detailed notes recorded for this call session.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Invoices Table */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Invoices
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All billed invoices, payment due dates, and settlement status.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {pluralize(invoices.length, 'Invoice')}
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No invoices found for this customer"
              description="No invoice billing records are registered under this customer account."
              icon={FileText}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-navy-700">
              <thead className="bg-slate-50 dark:bg-navy-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Invoice Number
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Due Date
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Days Overdue
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {invoices.map((inv) => {
                  const invOverdueDays = inv.status !== 'paid' ? calculateDaysOverdue(inv.due_date) : 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-700/50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(inv.due_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {inv.status === 'paid' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Settled</span>
                        ) : invOverdueDays > 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatOverdueDays(invOverdueDays)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Not yet due</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={inv.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Payment Promises */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Payment Promises
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Agreed collection schedules and payment commitment dates.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {pluralize(promises.length, 'Promise')}
          </span>
        </div>

        {promises.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payment promises recorded for this customer"
              description="When customer commits to deposit by an agreed date, promises will be tracked here."
              icon={Calendar}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-navy-700">
              <thead className="bg-slate-50 dark:bg-navy-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Promised Amount
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Promised Date
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Terms & Notes
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {promises.map((prom) => {
                  const isBroken = isPromiseBroken(prom);
                  const displayStatus = isBroken && prom.status === 'pending' ? 'missed' : prom.status;

                  return (
                    <tr key={prom.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-700/50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(prom.amount)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(prom.promised_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-xs">
                        {prom.notes || 'Agreed payment term'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={displayStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: Payments & Verification Proofs */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Payments & Verification Proofs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submitted deposit slips, bank transfer proofs, and verification history.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {pluralize(payments.length, 'Payment')}
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payment submissions recorded for this customer"
              description="Submitted payment slips and transaction proofs will appear here for manager review and approval."
              icon={Receipt}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-navy-700">
              <thead className="bg-slate-50 dark:bg-navy-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Submitted Date
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Verification Details
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {payments.map((payment) => {
                  const isPending = payment.status === 'pending_verification';
                  const isRejecting = rejectingPaymentId === payment.id;

                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-navy-700/50 transition ${
                        isPending ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(payment.submitted_at || payment.created_at, true)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={payment.status} />
                      </td>

                      {/* Verification Note / Rejection Reason */}
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                        {payment.status === 'verified' && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Verified on {formatDate(payment.verified_at, true)}
                          </span>
                        )}
                        {payment.status === 'rejected' && (
                          <span className="text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            Reason: {payment.rejection_reason || 'Rejected by Accounts Manager'}
                          </span>
                        )}
                        {payment.status === 'pending_verification' && (
                          <span className="text-amber-800 dark:text-amber-300 font-medium">
                            Awaiting manager verification
                          </span>
                        )}
                      </td>

                      {/* Verification Action Buttons */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isPending ? (
                          isRejecting ? (
                            <div className="inline-flex flex-col items-end gap-2 p-2 bg-slate-100 dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-md">
                              <input
                                type="text"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="State rejection reason..."
                                className="px-2.5 py-1 text-xs bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 w-48"
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleConfirmRejectPayment(payment.id)}
                                  disabled={actionProcessing}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700 transition"
                                >
                                  <Check className="w-3 h-3" />
                                  Confirm Rejection
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingPaymentId(null);
                                    setRejectionReason('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded text-[11px] font-medium hover:bg-slate-300 transition"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              {/* Approve Button */}
                              <button
                                onClick={() => handleApprovePayment(payment.id, payment.amount)}
                                disabled={actionProcessing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-sm transition disabled:opacity-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => {
                                  setRejectingPaymentId(payment.id);
                                  setRejectionReason('');
                                }}
                                disabled={actionProcessing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-navy-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md text-xs font-bold transition disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
