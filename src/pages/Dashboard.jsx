import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Receipt,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
  Store,
  User,
} from 'lucide-react';
import { supabase } from '../supabase';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatTime } from '../utils/formatters';
import { seedSampleData } from '../utils/seedData';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    callsToday: 0,
    paymentsCountToday: 0,
    paymentsSumToday: 0,
    totalOutstanding: 0,
    openFlagsCount: 0,
  });
  const [paymentsToday, setPaymentsToday] = useState([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Current Day Range (00:00:00 to 23:59:59 UTC/Local)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      // 1. Fetch Conversations / Calls made today
      const { count: callsTodayCount, error: callsErr } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd);

      if (callsErr) console.warn('Calls error:', callsErr.message);

      // 2. Fetch Payments received today (status = 'verified' and verified_at is today)
      const { data: verifiedPayments, error: paymentsErr } = await supabase
        .from('payments')
        .select(`
          id,
          customer_id,
          invoice_id,
          amount,
          status,
          verified_at,
          submitted_at
        `)
        .eq('status', 'verified')
        .gte('verified_at', todayStart)
        .lte('verified_at', todayEnd)
        .order('verified_at', { ascending: false });

      if (paymentsErr) console.warn('Payments error:', paymentsErr.message);

      // Fetch customer shop names for these payments
      const paymentCustomerIds = (verifiedPayments || [])
        .map((p) => p.customer_id)
        .filter(Boolean);

      let paymentsWithCustomer = [];
      if (paymentCustomerIds.length > 0) {
        const { data: custData } = await supabase
          .from('customers')
          .select('id, shop_name, owner_name, city')
          .in('id', paymentCustomerIds);

        const custMap = (custData || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {});

        paymentsWithCustomer = (verifiedPayments || []).map((p) => ({
          ...p,
          customer: custMap[p.customer_id] || { shop_name: 'Customer #' + p.customer_id, owner_name: '—' },
        }));
      }

      const paymentsSumToday = (verifiedPayments || []).reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );

      // 3. Fetch Total Outstanding across all customers
      const { data: allCustomers, count: totalCustCount, error: custErr } = await supabase
        .from('customers')
        .select('id, total_outstanding', { count: 'exact' });

      if (custErr) throw custErr;

      const totalOutstanding = (allCustomers || []).reduce(
        (sum, c) => sum + (Number(c.total_outstanding) || 0),
        0
      );
      setCustomersCount(totalCustCount || 0);

      // 4. Fetch Count of Open Flags
      const { count: openFlagsCount, error: flagsErr } = await supabase
        .from('flags')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      if (flagsErr) console.warn('Flags count error:', flagsErr.message);

      // Update State
      setStats({
        callsToday: callsTodayCount || 0,
        paymentsCountToday: (verifiedPayments || []).length,
        paymentsSumToday,
        totalOutstanding,
        openFlagsCount: openFlagsCount || 0,
      });

      setPaymentsToday(paymentsWithCustomer);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to retrieve dashboard analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSeed = async () => {
    setSeeding(true);
    const res = await seedSampleData();
    setSeeding(false);
    if (res.success) {
      fetchDashboardData();
    }
  };

  if (loading && customersCount === 0) {
    return <LoadingSpinner message="Calculating receivables summary..." />;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-navy-700 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Recovery Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time daily activity, collected dues, and pending recoveries summary.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal' : ''}`} />
            Refresh
          </button>

          <Link
            to="/customers"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal hover:bg-teal-600 rounded-lg shadow-sm transition"
          >
            View All Customers
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchDashboardData} />}

      {/* Zero Data Banner (Helper to populate realistic demo data if fresh DB) */}
      {customersCount === 0 && !loading && (
        <div className="rounded-lg border-2 border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-navy-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-teal shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Supabase Tables Connected & Ready
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                The database is connected with 0 records. You can load sample customers, unpaid invoices, conversation logs, and pending verification proofs to explore immediately.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal hover:bg-teal-600 rounded-md shrink-0 shadow-sm transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seeding ? 'Populating Data...' : 'Populate Sample Data'}
          </button>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Total Calls Made Today */}
        <StatCard
          title="Calls Made Today"
          value={stats.callsToday}
          subtitle="Customer follow-up calls"
          icon={PhoneCall}
          color="blue"
        />

        {/* 2. Total Payments Received Today */}
        <StatCard
          title="Payments Received Today"
          value={formatCurrency(stats.paymentsSumToday)}
          subtitle={`${stats.paymentsCountToday} verified ${stats.paymentsCountToday === 1 ? 'transaction' : 'transactions'}`}
          icon={CheckCircle2}
          color="emerald"
        />

        {/* 3. Total Outstanding Across All Customers */}
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(stats.totalOutstanding)}
          subtitle={`Across ${customersCount} total accounts`}
          icon={DollarSign}
          color="navy"
          onClick={() => navigate('/customers')}
        />

        {/* 4. Count of Open Flags */}
        <StatCard
          title="Open Urgent Flags"
          value={stats.openFlagsCount}
          subtitle={stats.openFlagsCount > 0 ? 'Requires immediate action' : 'No open disputes'}
          icon={AlertTriangle}
          color={stats.openFlagsCount > 0 ? 'rose' : 'teal'}
          badge={stats.openFlagsCount > 0 ? 'Urgent' : 'Clear'}
          badgeVariant={stats.openFlagsCount > 0 ? 'open' : 'resolved'}
        />
      </div>

      {/* Payments Received Today Section */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-mint" />
              Payments Received Today
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified receivables collected and reconciled today.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Total Today:{' '}
            <span className="text-emerald-600 dark:text-mint font-bold">
              {formatCurrency(stats.paymentsSumToday)}
            </span>
          </div>
        </div>

        {paymentsToday.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No payments received today"
              description="When payments are verified, they will automatically appear here with exact shop details and timestamps."
              icon={Receipt}
              action={
                <Link
                  to="/customers"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal dark:text-mint border border-teal dark:border-mint rounded hover:bg-teal-50 dark:hover:bg-navy-700 transition"
                >
                  Follow up with customers
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-navy-700">
              <thead className="bg-slate-50 dark:bg-navy-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Customer / Shop Name
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Owner Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Amount Received
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Verified Time
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {paymentsToday.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-navy-700/50 transition cursor-pointer"
                    onClick={() => navigate(`/customers/${payment.customer_id}`)}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-slate-400 shrink-0" />
                      {payment.customer?.shop_name || `Customer #${payment.customer_id}`}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {payment.customer?.owner_name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-mint text-sm">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatTime(payment.verified_at || payment.submitted_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="verified">Verified</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/customers/${payment.customer_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:text-teal-700 dark:text-mint dark:hover:text-mint/80"
                      >
                        View Account
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
