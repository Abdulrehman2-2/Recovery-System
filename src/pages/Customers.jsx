import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  Calendar,
  ChevronRight,
  RefreshCw,
  Store,
  User,
  Clock,
} from 'lucide-react';
import { supabase } from '../supabase';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency, formatDate, calculateDaysOverdue } from '../utils/formatters';

export function Customers() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [promises, setPromises] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortBy, setSortBy] = useState('outstanding_desc'); // outstanding_desc, days_desc, name_asc, broken_desc

  const navigate = useNavigate();

  const fetchCustomersData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Customers
      const { data: custList, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .order('total_outstanding', { ascending: false });

      if (custErr) throw custErr;

      // 2. Fetch Invoices (unpaid/overdue to compute earliest due_date)
      const { data: invList, error: invErr } = await supabase
        .from('invoices')
        .select('customer_id, due_date, status, amount');

      if (invErr) console.warn('Invoices fetch error:', invErr.message);

      // 3. Fetch Payment Promises
      const { data: promList, error: promErr } = await supabase
        .from('payment_promises')
        .select('customer_id, amount, promised_date, status')
        .order('promised_date', { ascending: true });

      if (promErr) console.warn('Promises fetch error:', promErr.message);

      // 4. Fetch Open Flags
      const { data: flagList, error: flagErr } = await supabase
        .from('flags')
        .select('id, customer_id, reason, status')
        .eq('status', 'open');

      if (flagErr) console.warn('Flags fetch error:', flagErr.message);

      setCustomers(custList || []);
      setInvoices(invList || []);
      setPromises(promList || []);
      setFlags(flagList || []);
    } catch (err) {
      console.error('Error fetching customers page data:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomersData();
  }, [fetchCustomersData]);

  // Aggregate customer calculations
  const customerDetailsMap = useMemo(() => {
    const map = {};

    // Group invoices by customer
    const invMap = {};
    (invoices || []).forEach((inv) => {
      if (!invMap[inv.customer_id]) invMap[inv.customer_id] = [];
      // Consider unpaid or overdue invoices
      if (inv.status !== 'paid') {
        invMap[inv.customer_id].push(inv);
      }
    });

    // Group promises by customer
    const promMap = {};
    (promises || []).forEach((prom) => {
      if (!promMap[prom.customer_id]) promMap[prom.customer_id] = [];
      promMap[prom.customer_id].push(prom);
    });

    // Group open flags by customer
    const flagMap = {};
    (flags || []).forEach((flag) => {
      if (!flagMap[flag.customer_id]) flagMap[flag.customer_id] = [];
      flagMap[flag.customer_id].push(flag);
    });

    (customers || []).forEach((cust) => {
      const custInvoices = invMap[cust.id] || [];
      const custPromises = promMap[cust.id] || [];
      const custFlags = flagMap[cust.id] || [];

      // Calculate Earliest Due Date for unpaid invoices
      let earliestDueDate = null;
      custInvoices.forEach((inv) => {
        if (inv.due_date) {
          if (!earliestDueDate || new Date(inv.due_date) < new Date(earliestDueDate)) {
            earliestDueDate = inv.due_date;
          }
        }
      });

      const daysOverdue = earliestDueDate ? calculateDaysOverdue(earliestDueDate) : 0;

      // Open promise: status = 'pending', earliest promised_date
      const openPromises = custPromises
        .filter((p) => p.status === 'pending' && p.promised_date)
        .sort((a, b) => new Date(a.promised_date) - new Date(b.promised_date));

      const openPromise = openPromises.length > 0 ? openPromises[0] : null;

      // Broken promises count: status = 'missed'
      const brokenCount = custPromises.filter((p) => p.status === 'missed').length;

      // Has open flags
      const hasOpenFlags = custFlags.length > 0;

      map[cust.id] = {
        daysOverdue,
        earliestDueDate,
        openPromise,
        brokenCount,
        hasOpenFlags,
        flagCount: custFlags.length,
      };
    });

    return map;
  }, [customers, invoices, promises, flags]);

  // Process Search, Filters, and Sorting
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((cust) => {
        // Search
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (cust.shop_name && cust.shop_name.toLowerCase().includes(q)) ||
          (cust.owner_name && cust.owner_name.toLowerCase().includes(q)) ||
          (cust.city && cust.city.toLowerCase().includes(q)) ||
          (cust.phone && cust.phone.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        // Priority filter
        if (priorityFilter !== 'all' && (cust.priority || 'medium').toLowerCase() !== priorityFilter) {
          return false;
        }

        // Flag filter
        const details = customerDetailsMap[cust.id] || {};
        if (flagFilter === 'flagged' && !details.hasOpenFlags) return false;
        if (flagFilter === 'broken' && details.brokenCount === 0) return false;

        return true;
      })
      .sort((a, b) => {
        const detA = customerDetailsMap[a.id] || {};
        const detB = customerDetailsMap[b.id] || {};

        if (sortBy === 'outstanding_desc') {
          return (Number(b.total_outstanding) || 0) - (Number(a.total_outstanding) || 0);
        }
        if (sortBy === 'outstanding_asc') {
          return (Number(a.total_outstanding) || 0) - (Number(b.total_outstanding) || 0);
        }
        if (sortBy === 'days_desc') {
          return (detB.daysOverdue || 0) - (detA.daysOverdue || 0);
        }
        if (sortBy === 'broken_desc') {
          return (detB.brokenCount || 0) - (detA.brokenCount || 0);
        }
        if (sortBy === 'name_asc') {
          return (a.shop_name || '').localeCompare(b.shop_name || '');
        }
        return 0;
      });
  }, [customers, searchQuery, priorityFilter, flagFilter, sortBy, customerDetailsMap]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-navy-700 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Accounts & Customers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Search, filter, and track recovery status across all client accounts.
          </p>
        </div>

        <button
          onClick={fetchCustomersData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal' : ''}`} />
          Refresh List
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchCustomersData} />}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by shop name, owner, city, or phone..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent transition"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="priority-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Priority:
          </label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs py-2 px-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Status / Flag Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="risk-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Risk:
          </label>
          <select
            id="risk-filter"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="text-xs py-2 px-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="all">All Accounts</option>
            <option value="flagged">Open Flags Only</option>
            <option value="broken">Broken Promises Only</option>
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Sort:
          </label>
          <select
            id="sort-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs py-2 px-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="outstanding_desc">Highest Outstanding</option>
            <option value="outstanding_asc">Lowest Outstanding</option>
            <option value="days_desc">Most Days Overdue</option>
            <option value="broken_desc">Most Broken Promises</option>
            <option value="name_asc">Shop Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner message="Fetching customers and calculating overdue metrics..." />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={searchQuery ? 'No matching customers found' : 'No customers in database'}
              description={
                searchQuery
                  ? `No customer accounts match your search query "${searchQuery}". Try clearing filters.`
                  : 'Add customer records to your Supabase database to start tracking receivables.'
              }
              icon={Store}
              action={
                searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPriorityFilter('all');
                      setFlagFilter('all');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-teal dark:text-mint border border-teal dark:border-mint rounded hover:bg-teal-50 dark:hover:bg-navy-700 transition"
                  >
                    Clear Search Filters
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="px-3 py-1.5 text-xs font-semibold text-teal dark:text-mint border border-teal dark:border-mint rounded hover:bg-teal-50 dark:hover:bg-navy-700 transition"
                  >
                    Back to Dashboard
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-navy-700">
              <thead className="bg-slate-50 dark:bg-navy-900 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Shop & Owner Name
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Total Outstanding
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Last Contacted
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Days Overdue
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Open Promise
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Broken Promises
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Alerts
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {filteredCustomers.map((cust) => {
                  const details = customerDetailsMap[cust.id] || {};

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => navigate(`/customers/${cust.id}`)}
                      className={`hover:bg-slate-50/90 dark:hover:bg-navy-700/60 transition cursor-pointer ${
                        details.hasOpenFlags ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Shop Name and Owner */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-md bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                            <Store className="w-4 h-4 text-teal dark:text-mint" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                              {cust.shop_name || 'Unnamed Shop'}
                              {cust.priority && (
                                <Badge variant={cust.priority} className="text-[10px] py-0 px-1.5">
                                  {cust.priority}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                {cust.owner_name || 'No Owner Listed'}
                              </span>
                              {cust.city && <span>• {cust.city}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Outstanding */}
                      <td className="px-4 py-4 text-right font-extrabold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                        {formatCurrency(cust.total_outstanding)}
                      </td>

                      {/* Last Contacted Date */}
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(cust.last_contacted_at)}
                        </div>
                      </td>

                      {/* Days Overdue */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {details.daysOverdue > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                              details.daysOverdue > 30
                                ? 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                                : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {details.daysOverdue} days
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">On Track</span>
                        )}
                      </td>

                      {/* Open Promise (Amount and Date from payment_promises where status = 'pending') */}
                      <td className="px-5 py-4">
                        {details.openPromise ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-blue-700 dark:text-blue-300 text-xs">
                              {formatCurrency(details.openPromise.amount)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(details.openPromise.promised_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No open promise</span>
                        )}
                      </td>

                      {/* Broken Promises Count */}
                      <td className="px-4 py-4 text-center">
                        {details.brokenCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                            {details.brokenCount} missed
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0</span>
                        )}
                      </td>

                      {/* Red Flag Icon if Open Flags */}
                      <td className="px-4 py-4 text-center">
                        {details.hasOpenFlags ? (
                          <span
                            title="Open Urgent Flag"
                            className="inline-flex items-center justify-center p-1.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 animate-pulse"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-navy-700">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/customers/${cust.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:text-teal-700 dark:text-mint dark:hover:text-mint/80 bg-teal-50 dark:bg-navy-700 px-2.5 py-1 rounded border border-teal-200 dark:border-navy-600 transition"
                        >
                          View
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer with counts */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{filteredCustomers.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{customers.length}</strong> accounts
            </span>
            <span>Click any customer row to view detailed recovery history</span>
          </div>
        )}
      </div>
    </div>
  );
}
