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
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Bot,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { supabase } from '../supabase';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatDate, calculateDaysOverdue, formatTime } from '../utils/formatters';
import { useNotifications } from '../context/NotificationContext';

export function CustomerDetail() {
  const { id } = useParams();
  const { refreshNotifications } = useNotifications();


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Data
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [promises, setPromises] = useState([]);
  const [payments, setPayments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [flags, setFlags] = useState([]);

  // Expanded Conversations for Chat messages
  const [expandedConvId, setExpandedConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Payment Action States
  const [rejectingPaymentId, setRejectingPaymentId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  const fetchCustomerDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Customer record
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (custErr) throw custErr;
      if (!custData) throw new Error('Customer account not found.');

      // 2. Invoices
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', id)
        .order('due_date', { ascending: false });

      if (invErr) console.warn('Invoices error:', invErr.message);

      // 3. Payment Promises
      const { data: promData, error: promErr } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('customer_id', id)
        .order('promised_date', { ascending: false });

      if (promErr) console.warn('Promises error:', promErr.message);

      // 4. Payments
      const { data: payData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', id)
        .order('submitted_at', { ascending: false });

      if (payErr) console.warn('Payments error:', payErr.message);

      // 5. Conversations
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', id)
        .order('started_at', { ascending: false });

      if (convErr) console.warn('Conversations error:', convErr.message);

      // 6. Flags
      const { data: flagData, error: flagErr } = await supabase
        .from('flags')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (flagErr) console.warn('Flags error:', flagErr.message);

      setCustomer(custData);
      setInvoices(invData || []);
      setPromises(promData || []);
      setPayments(payData || []);
      setConversations(convData || []);
      setFlags(flagData || []);

      // If conversations exist, auto-load and expand the first conversation
      if (convData && convData.length > 0) {
        const firstConvId = convData[0].id;
        setExpandedConvId((prev) => prev || firstConvId);

        const { data: firstMsgData } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', firstConvId)
          .order('sent_at', { ascending: true });

        if (firstMsgData) {
          setMessagesByConv((prev) => ({
            ...prev,
            [firstConvId]: firstMsgData,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load customer details:', err);
      setError(err.message || 'Failed to fetch customer profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomerDetails();
  }, [fetchCustomerDetails]);

  // Expand / Collapse Conversation and Load Messages
  const handleToggleConversation = async (convId) => {
    if (expandedConvId === convId) {
      setExpandedConvId(null);
      return;
    }

    setExpandedConvId(convId);

    // Fetch messages for this conversation if not already cached
    if (!messagesByConv[convId]) {
      try {
        setLoadingMessages(true);
        const { data: msgData, error: msgErr } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('sent_at', { ascending: true });

        if (msgErr) console.warn('Messages error:', msgErr.message);

        setMessagesByConv((prev) => ({
          ...prev,
          [convId]: msgData || [],
        }));
      } catch (err) {
        console.error('Error loading chat messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  // Approve Payment
  const handleApprovePayment = async (paymentId, amount) => {
    try {
      setActionProcessing(true);
      const verifiedAt = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'verified',
          verified_at: verifiedAt,
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      // Update customer total_outstanding in database as well
      if (customer && amount) {
        const newOutstanding = Math.max(0, (Number(customer.total_outstanding) || 0) - Number(amount));
        await supabase
          .from('customers')
          .update({ total_outstanding: newOutstanding })
          .eq('id', customer.id);

        setCustomer((prev) => ({
          ...prev,
          total_outstanding: newOutstanding,
        }));
      }

      setActionSuccessMessage(`Payment of ${formatCurrency(amount)} verified successfully!`);
      setTimeout(() => setActionSuccessMessage(null), 4000);

      // Refresh list and global notifications
      await fetchCustomerDetails();
      refreshNotifications();
    } catch (err) {
      console.error('Failed to approve payment:', err);
      alert('Error approving payment: ' + err.message);
    } finally {
      setActionProcessing(false);
    }
  };

  // Reject Payment
  const handleConfirmRejectPayment = async (paymentId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this payment proof.');
      return;
    }

    try {
      setActionProcessing(true);

      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      setRejectingPaymentId(null);
      setRejectionReason('');
      setActionSuccessMessage('Payment rejected with reason recorded.');
      setTimeout(() => setActionSuccessMessage(null), 4000);

      // Refresh list and global notifications
      await fetchCustomerDetails();
      refreshNotifications();
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
      const { error: flagErr } = await supabase
        .from('flags')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', flagId);

      if (flagErr) throw flagErr;
      await fetchCustomerDetails();
      refreshNotifications();
    } catch (err) {
      console.error('Error resolving flag:', err);
    }
  };

  // Calculated Stats
  const earliestUnpaidDueDate = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'paid' && i.due_date);
    if (unpaid.length === 0) return null;
    return unpaid.reduce((earliest, curr) => {
      return !earliest || new Date(curr.due_date) < new Date(earliest) ? curr.due_date : earliest;
    }, null);
  }, [invoices]);

  const daysOverdue = useMemo(() => {
    return earliestUnpaidDueDate ? calculateDaysOverdue(earliestUnpaidDueDate) : 0;
  }, [earliestUnpaidDueDate]);

  const brokenPromisesCount = useMemo(() => {
    return promises.filter((p) => p.status === 'missed').length;
  }, [promises]);

  const openFlags = useMemo(() => {
    return flags.filter((f) => f.status === 'open');
  }, [flags]);

  if (loading && !customer) {
    return <LoadingSpinner message="Loading customer account details..." />;
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal dark:text-mint"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
        <ErrorMessage
          message={error || 'Customer not found'}
          onRetry={fetchCustomerDetails}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Back Navigation Bar */}
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
          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 transition"
          title="Refresh Customer Details"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal' : ''}`} />
        </button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-xs font-semibold shadow-sm animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {actionSuccessMessage}
          </div>
          <button onClick={() => setActionSuccessMessage(null)}>
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      )}

      {/* Open Flag Alert Banner */}
      {openFlags.length > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-l-rose-600 border border-rose-200 dark:border-rose-900 rounded-r-lg space-y-2">
          {openFlags.map((flag) => (
            <div key={flag.id} className="flex items-start justify-between gap-3">
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
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-navy-800 border border-rose-300 dark:border-rose-800 rounded hover:bg-rose-100 transition whitespace-nowrap"
              >
                Mark Resolved
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Customer Header Card */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Info */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-50 dark:bg-navy-900 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal dark:text-mint shrink-0">
              <Store className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {customer.shop_name || 'Customer Account'}
                </h1>
                {customer.status && (
                  <Badge variant={customer.status} className="uppercase font-bold">
                    {customer.status}
                  </Badge>
                )}
                {customer.priority && (
                  <Badge variant={customer.priority} className="uppercase font-bold">
                    Priority: {customer.priority}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {customer.owner_name || 'Owner unlisted'}
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
                  Last contacted: {formatDate(customer.last_contacted_at)}
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
          subtitle={`${invoices.filter((i) => i.status !== 'paid').length} unpaid invoices`}
          icon={DollarSign}
          color="navy"
        />

        {/* 2. Days Overdue */}
        <StatCard
          title="Days Overdue"
          value={daysOverdue > 0 ? `${daysOverdue} Days` : 'On Track'}
          subtitle={
            earliestUnpaidDueDate
              ? `Earliest due: ${formatDate(earliestUnpaidDueDate)}`
              : 'No overdue invoices'
          }
          icon={Calendar}
          color={daysOverdue > 30 ? 'rose' : daysOverdue > 0 ? 'rose' : 'teal'}
          badge={daysOverdue > 30 ? 'High Risk' : daysOverdue > 0 ? 'Past Due' : 'Current'}
        />

        {/* 3. Follow-up Count */}
        <StatCard
          title="Follow-up Count"
          value={customer.follow_up_count || conversations.length}
          subtitle={`${conversations.length} logged call sessions`}
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
              : 'Reliable payment history'
          }
          icon={AlertTriangle}
          color={brokenPromisesCount > 0 ? 'rose' : 'emerald'}
          badge={brokenPromisesCount > 0 ? 'Defaulter Risk' : 'Clean'}
        />
      </div>

      {/* SECTION 1: Calls / Conversations */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Calls & Conversations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audio call transcripts, agent summaries, and chronological chat logs.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {conversations.length} Logs
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No conversations recorded yet"
              description="When automated recovery calls or agent calls are conducted, full transcripts and outcomes will appear here."
              icon={PhoneCall}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {conversations.map((conv) => {
              const isExpanded = expandedConvId === conv.id;
              const messages = messagesByConv[conv.id] || [];

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
                            <Badge variant={conv.outcome} className="text-[10px]">
                              {conv.outcome.replace(/_/g, ' ')}
                            </Badge>
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
                        {isExpanded ? 'Hide Chat' : 'View Full Chat'}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Conversation Chat View */}
                  {isExpanded && (
                    <div className="px-6 py-5 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 space-y-4">
                      {/* Summary Box */}
                      {conv.summary && (
                        <div className="p-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Call Summary:
                          </span>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {conv.summary}
                          </p>
                        </div>
                      )}

                      {/* Chat Messages Container */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Chronological Chat Log
                        </h4>

                        {loadingMessages && messages.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-500">
                            Loading conversation messages...
                          </div>
                        ) : messages.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            No individual message fragments logged for this session.
                          </p>
                        ) : (
                          <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-2">
                            {messages.map((msg) => {
                              const isAgent =
                                (msg.sender_type || msg.sender || msg.role || '').toLowerCase() ===
                                  'agent' ||
                                (msg.sender_type || msg.sender || msg.role || '').toLowerCase() ===
                                  'assistant' ||
                                (msg.sender_type || msg.sender || msg.role || '').toLowerCase() ===
                                  'system';

                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${
                                    isAgent ? 'items-start' : 'items-end'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mb-1 px-1">
                                    {isAgent ? (
                                      <>
                                        <Bot className="w-3 h-3 text-teal dark:text-mint" />
                                        <span>Agent (PayMate)</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>{customer.owner_name || customer.shop_name || 'Customer'}</span>
                                        <User className="w-3 h-3 text-blue-500" />
                                      </>
                                    )}
                                    <span>•</span>
                                    <span>{formatTime(msg.sent_at || msg.created_at)}</span>
                                  </div>

                                  <div
                                    className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed ${
                                      isAgent
                                        ? 'bg-white dark:bg-navy-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-navy-700 rounded-tl-sm'
                                        : 'bg-teal text-white dark:bg-teal-600 rounded-tr-sm'
                                    }`}
                                  >
                                    {msg.message_text || msg.content || msg.text || msg.message}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                All billed invoices, due dates, and payment settlement statuses.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {invoices.length} Invoices
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No invoices registered"
              description="No invoice billing records found for this customer account."
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
                        {inv.invoice_number}
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
                        {invOverdueDays > 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {invOverdueDays} days overdue
                          </span>
                        ) : inv.status === 'paid' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cleared</span>
                        ) : (
                          <span className="text-slate-400 font-medium">Within due date</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={inv.status}>{inv.status}</Badge>
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
                Commitments made by the customer during calls and collection negotiations.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {promises.length} Promises
          </span>
        </div>

        {promises.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payment promises recorded"
              description="When a customer commits to pay by a specific date, promise logs are saved here."
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
                    Notes / Condition
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {promises.map((prom) => (
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
                      {prom.notes || 'Agreed settlement term'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Badge variant={prom.status}>{prom.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: Payments Table with Approve & Reject Actions */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal dark:text-mint" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Payments & Verification Proofs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submitted deposit slips, bank proofs, and verification history.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300">
            {payments.length} Payments
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payment submissions recorded"
              description="Any payment receipts or bank slips submitted for this customer will appear here for verification."
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
                    Verification Note / Reason
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Verification Action
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
                        <Badge variant={payment.status}>
                          {payment.status === 'pending_verification'
                            ? 'Pending Verification'
                            : payment.status}
                        </Badge>
                      </td>

                      {/* Verification Note / Rejection Reason */}
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                        {payment.status === 'verified' && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified on {formatDate(payment.verified_at, true)}
                          </span>
                        )}
                        {payment.status === 'rejected' && (
                          <span className="text-rose-700 dark:text-rose-300 font-medium">
                            Reason: {payment.rejection_reason || 'Rejected by Accounts Manager'}
                          </span>
                        )}
                        {payment.status === 'pending_verification' && (
                          <span className="text-amber-800 dark:text-amber-300 font-medium">
                            Awaiting manager approval
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isPending ? (
                          isRejecting ? (
                            <div className="inline-flex flex-col items-end gap-2 p-2 bg-slate-100 dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-md">
                              <input
                                type="text"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Rejection reason..."
                                className="px-2.5 py-1 text-xs bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 w-48"
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleConfirmRejectPayment(payment.id)}
                                  disabled={actionProcessing}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700 transition"
                                >
                                  <Check className="w-3 h-3" />
                                  Confirm Reject
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
