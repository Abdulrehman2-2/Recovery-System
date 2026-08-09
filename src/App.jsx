import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import {
  Bell, Sun, Moon, Phone, FileText, Search, X, CheckCircle2,
  XCircle, Clock, ChevronRight, TrendingUp, Wallet, Users, PhoneCall, Check, Loader2, AlertCircle
} from "lucide-react";

// TEMPORARY DEBUG INTERCEPTOR TO SEE WHAT HEADERS THE BROWSER IS SENDING
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const req = new Request(...args);
  if (req.url.includes('supabase.co')) {
    console.log("--- OUTGOING SUPABASE REQUEST ---");
    console.log("URL:", req.url);
    console.log("HEADERS:", Object.fromEntries(req.headers.entries()));
  }
  return originalFetch(...args);
};

const money = (n, c = "PKR") =>
  n == null ? "—" : `${c} ${Number(n).toLocaleString("en-PK")}`;

const ago = (iso) => {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

const dt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
};

export default function RecoveryDashboard() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("accounts");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);
  
  // Data States
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [callsTodayCount, setCallsTodayCount] = useState(0);
  
  // Loading States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // UI States
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const closeBell = () => { setBellOpen(false); };

  const resolveNotif = async (e, id) => {
    e.stopPropagation();
    // Optimistic UI update
    setNotifs((prev) => prev.filter(n => n.id !== id));
    // Update DB
    await supabase.from("flags").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
  };

  // Fetch Initial Data
  useEffect(() => {
    async function loadData() {
      setLoadingInitial(true);
      try {
        const [customersRes, paymentsRes, callsRes, flagsRes, promisesRes, invoicesRes] = await Promise.all([
          supabase.from("customers").select("*").order("priority", { ascending: false }),
          supabase.from("payments").select("*, customers(shop_name), invoices(invoice_number)").eq("status", "pending").order("submitted_at", { ascending: false }),
          supabase.from("calls").select("*", { count: "exact", head: true }).gte("started_at", new Date().toISOString().slice(0, 10)),
          supabase.from("flags").select("*").eq("status", "open"),
          supabase.from("payment_promises").select("*"),
          supabase.from("invoices").select("customer_id, due_date").eq("status", "unpaid")
        ]);
        
        // Log any explicit Supabase API errors
        const errors = [customersRes, paymentsRes, callsRes, flagsRes, promisesRes, invoicesRes].filter(r => r.error);
        if (errors.length > 0) {
          console.error("⚠️ Supabase API Errors encountered:", errors.map(e => e.error));
          alert("Supabase API Error. Check the browser console.");
        }

        const rawCustomers = customersRes.data || [];
        const rawPromises = promisesRes.data || [];
        const rawFlags = flagsRes.data || [];
        const rawInvoices = invoicesRes.data || [];

        const enrichedCustomers = rawCustomers.map(c => {
          const cFlags = rawFlags.filter(f => f.customer_id === c.id);
          const broken = cFlags.filter(f => f.type === 'broken_promise').length;
          const has_active_flags = cFlags.length > 0;
          
          const nextPromise = rawPromises
            .filter(p => p.customer_id === c.id && p.status === 'pending')
            .sort((a,b) => new Date(a.promised_date) - new Date(b.promised_date))[0];
            
          const cInvoices = rawInvoices.filter(i => i.customer_id === c.id);
          const earliestDue = cInvoices.sort((a,b) => new Date(a.due_date) - new Date(b.due_date))[0];
          let days_overdue = 0;
          if (earliestDue) {
             const diffTime = Date.now() - new Date(earliestDue.due_date);
             days_overdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
          }
          
          return {
            ...c,
            broken_promises: broken,
            has_active_flags,
            open_promise_amount: nextPromise?.amount,
            open_promise_date: nextPromise?.promised_date,
            days_overdue: days_overdue
          };
        });
        
        setCustomers(enrichedCustomers);
        console.log("enrichedCustomers:", enrichedCustomers);
        
        if (paymentsRes.data) {
          const mappedPayments = paymentsRes.data.map(p => ({
            ...p,
            shop_name: p.customers?.shop_name || "Unknown",
            invoice_no: p.invoices?.invoice_number || null
          }));
          setPayments(mappedPayments);
        }
        
        if (callsRes.count !== null) setCallsTodayCount(callsRes.count);
        
        if (rawFlags) {
          setNotifs(rawFlags.map(f => ({
            id: f.id,
            text: `[${(f.severity || "info").toUpperCase()}] ${f.reason}`,
            at: f.created_at
          })));
        }
        
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Fetch timeline when a customer is selected
  useEffect(() => {
    if (!selected) return;
    
    async function loadTimeline() {
      setLoadingTimeline(true);
      const [calls, pay, flags] = await Promise.all([
        supabase.from("calls").select("*").eq("customer_id", selected.id),
        supabase.from("payments").select("*").eq("customer_id", selected.id),
        supabase.from("flags").select("*").eq("customer_id", selected.id)
      ]);
      
      const history = [];
      
      if (calls.data) {
        calls.data.forEach(c => history.push({
          id: `c_${c.id}`,
          type: "call",
          title: `Call (${c.outcome})`,
          body: c.summary || c.transcript || "No transcript available.",
          occurred_at: c.started_at,
          meta: `Duration: ${c.duration_seconds}s`,
          actor: "AI Agent",
          color: c.outcome === "answered" ? "bg-emerald-500" : "bg-neutral-400"
        }));
      }
      
      if (pay.data) {
        pay.data.forEach(p => history.push({
          id: `p_${p.id}`,
          type: "payment",
          title: `Payment Proof (${p.status})`,
          body: `Received proof for ${money(p.amount)} via ${p.payment_method}.`,
          occurred_at: p.submitted_at,
          meta: p.verified_by ? `Verified by ${p.verified_by}` : "Pending Verification",
          actor: "System",
          color: "bg-blue-500"
        }));
      }
      
      if (flags.data) {
        flags.data.forEach(f => history.push({
          id: `f_${f.id}`,
          type: "flag",
          title: `Flag: ${(f.type || "").replace('_', ' ')}`,
          body: f.reason,
          occurred_at: f.created_at,
          meta: f.status,
          actor: "System",
          color: "bg-red-500"
        }));
      }
      
      history.sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at));
      
      setTimeline(history);
      setLoadingTimeline(false);
    }
    loadTimeline();
  }, [selected]);

  const decideProof = async (id, decision) => {
    setLoadingAction(true);
    const { error } = await supabase
      .from("payments")
      .update({ 
        status: decision,
        verified_at: new Date().toISOString(),
        verified_by: "Saim"
      })
      .eq("id", id);
      
    if (!error) {
      setPayments((p) => p.filter((x) => x.id !== id));
      setReceipt(null);
    } else {
      console.error("Error updating proof:", error);
    }
    setLoadingAction(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (receipt) setReceipt(null);
      else if (selected) setSelected(null);
      else if (bellOpen) closeBell();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [receipt, selected, bellOpen]);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => !q || (c.shop_name || "").toLowerCase().includes(q));
  }, [customers, query]);

  const stats = {
    outstanding: customers.reduce((s, c) => s + (Number(c.total_outstanding) || 0), 0),
    accounts: customers.length,
    callsToday: callsTodayCount,
    pendingProofs: payments.length,
  };

  const t = dark
    ? {
        page: "bg-neutral-950 text-neutral-100",
        panel: "bg-neutral-900 border-neutral-800",
        sub: "text-neutral-400",
        faint: "text-neutral-500",
        hover: "hover:bg-neutral-800/60",
        input: "bg-neutral-900 border-neutral-800 placeholder-neutral-600",
        chip: "bg-neutral-800 text-neutral-300",
        divide: "divide-neutral-800",
        bar: "bg-neutral-950/80 border-neutral-800",
        active: "bg-neutral-100 text-neutral-900",
        idle: "text-neutral-400 hover:text-neutral-100",
      }
    : {
        page: "bg-neutral-50 text-neutral-900",
        panel: "bg-white border-neutral-200",
        sub: "text-neutral-500",
        faint: "text-neutral-400",
        hover: "hover:bg-neutral-50",
        input: "bg-white border-neutral-200 placeholder-neutral-400",
        chip: "bg-neutral-100 text-neutral-600",
        divide: "divide-neutral-200",
        bar: "bg-white/80 border-neutral-200",
        active: "bg-neutral-900 text-white",
        idle: "text-neutral-500 hover:text-neutral-900",
      };

  const Stat = ({ icon: Icon, label, value, tone }) => (
    <div className={`rounded-xl border p-4 ${t.panel}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] uppercase tracking-widest ${t.faint}`}>{label}</span>
        <Icon size={15} className={tone || t.faint} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {loadingInitial ? <Loader2 size={20} className="animate-spin text-neutral-400" /> : value}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${t.page} transition-colors`}>
      {/* ---------------- header ---------------- */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur ${t.bar}`}>
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white">
              <Wallet size={15} />
            </div>
            <span className="text-sm font-semibold tracking-tight">Recovery Desk</span>
          </div>

          <nav className="ml-4 flex gap-1">
            {[
              ["accounts", "Accounts"],
              ["proofs", "Payment Proofs"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  tab === k ? t.active : t.idle
                }`}
              >
                {label}
                {k === "proofs" && payments.length > 0 && (
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                    tab === k ? "bg-white/20" : t.chip
                  }`}>
                    {payments.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => (bellOpen ? closeBell() : setBellOpen(true))}
                className={`relative rounded-lg p-2 ${t.hover}`}
                aria-label="Notifications"
              >
                <Bell size={17} />
                {notifs.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-medium tabular-nums text-white">
                    {notifs.length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={closeBell} />
                  <div className={`absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl ${t.panel}`}>
                    <div className={`flex items-center justify-between border-b px-4 py-2.5 ${t.divide.replace("divide", "border")}`}>
                      <span className="text-xs font-medium uppercase tracking-widest">Flags / Notifications</span>
                      <button onClick={closeBell} className={t.faint}><X size={14} /></button>
                    </div>
                    {notifs.length === 0 ? (
                      <div className={`px-4 py-8 text-center text-sm ${t.sub}`}>You're all caught up</div>
                    ) : (
                      <ul className={`divide-y ${t.divide}`}>
                        {notifs.map((n) => (
                          <li key={n.id} className={`group flex items-start justify-between gap-3 px-4 py-3 ${t.hover}`}>
                            <div>
                              <p className="text-sm leading-snug">{n.text}</p>
                              <p className={`mt-0.5 text-xs ${t.faint}`}>{ago(n.at)}</p>
                            </div>
                            <button
                              onClick={(e) => resolveNotif(e, n.id)}
                              className={`mt-0.5 flex-shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 ${t.panel} hover:bg-emerald-500/10 hover:text-emerald-500 border-none shadow-sm`}
                              title="Mark flag as resolved"
                            >
                              <Check size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setDark((d) => !d)} className={`rounded-lg p-2 ${t.hover}`} aria-label="Toggle theme">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* ---------------- stats ---------------- */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={TrendingUp} label="Total Outstanding" value={money(stats.outstanding)} tone="text-amber-500" />
          <Stat icon={Users} label="Active Accounts" value={stats.accounts} />
          <Stat icon={PhoneCall} label="Calls Today" value={stats.callsToday} tone="text-emerald-500" />
          <Stat icon={FileText} label="Proofs Pending" value={stats.pendingProofs} tone="text-blue-500" />
        </div>

        {/* ---------------- accounts ---------------- */}
        {tab === "accounts" && (
          <section className={`overflow-hidden rounded-xl border ${t.panel}`}>
            <div className={`flex items-center gap-3 border-b px-4 py-3 ${t.divide.replace("divide", "border")}`}>
              <Search size={15} className={t.faint} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts…"
                className={`w-full bg-transparent text-sm outline-none ${t.input.split(" ").pop()}`}
              />
            </div>
            
            {loadingInitial ? (
              <div className="flex justify-center p-12"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>
            ) : filteredCustomers.length === 0 ? (
               <div className={`p-12 text-center text-sm ${t.sub}`}>No accounts found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-left text-[11px] uppercase tracking-widest ${t.faint} ${t.divide.replace("divide", "border")}`}>
                    <th className="px-4 py-2.5 font-medium">Shop Name</th>
                    <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                    <th className="px-4 py-2.5 text-right font-medium">Overdue</th>
                    <th className="px-4 py-2.5 text-right font-medium">Broken</th>
                    <th className="px-4 py-2.5 font-medium">Next Promise</th>
                    <th className="px-4 py-2.5 font-medium">Last Contact</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divide}`}>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} onClick={() => setSelected(c)} className={`cursor-pointer ${t.hover}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-1.5">
                          {c.shop_name}
                          {c.has_active_flags && <AlertCircle size={14} className="text-red-500" title="Needs human intervention" />}
                        </div>
                        <div className={`text-xs ${t.faint}`}>{c.owner_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(c.total_outstanding)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={c.days_overdue >= 60 ? "text-red-500" : c.days_overdue >= 30 ? "text-amber-500" : ""}>
                          {c.days_overdue}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.broken_promises > 0
                          ? <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-500">{c.broken_promises}</span>
                          : <span className={t.faint}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.open_promise_date
                          ? <><span className="tabular-nums">{money(c.open_promise_amount)}</span>
                              <span className={`ml-1.5 text-xs ${t.faint}`}>{dt(c.open_promise_date)}</span></>
                          : <span className={t.faint}>—</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs ${t.sub}`}>{ago(c.last_contacted_at)}</td>
                      <td className="pr-3"><ChevronRight size={14} className={t.faint} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ---------------- payment proofs ---------------- */}
        {tab === "proofs" && (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loadingInitial ? (
              <div className="col-span-full flex justify-center p-12"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>
            ) : payments.length === 0 ? (
              <div className={`col-span-full rounded-xl border py-16 text-center ${t.panel} ${t.sub}`}>
                <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-500" />
                <p className="text-sm">No proofs waiting on review</p>
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className={`rounded-xl border p-4 ${t.panel}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{p.shop_name}</div>
                      <div className={`text-xs ${t.faint}`}>via {p.payment_method}</div>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${t.chip}`}>
                      <Clock size={9} className="mr-1 inline" />{ago(p.submitted_at)}
                    </span>
                  </div>

                  <div className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">
                    {money(p.amount)}
                  </div>

                  <dl className={`mt-3 space-y-1.5 text-xs ${t.sub}`}>
                    <div className="flex justify-between"><dt>Date</dt><dd className="tabular-nums">{dt(p.submitted_at)}</dd></div>
                    <div className="flex justify-between"><dt>Invoice</dt><dd>{p.invoice_no ?? <span className="text-amber-500">Unmatched</span>}</dd></div>
                  </dl>

                  <button
                    onClick={() => setReceipt(p)}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm ${t.hover} ${t.panel}`}
                  >
                    <FileText size={14} /> View Receipt
                  </button>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => decideProof(p.id, "verified")}
                      disabled={loadingAction}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> Verify
                    </button>
                    <button
                      onClick={() => decideProof(p.id, "rejected")}
                      disabled={loadingAction}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm text-red-500 hover:bg-red-500/10 ${t.panel} disabled:opacity-50`}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      {/* ---------------- receipt lightbox ---------------- */}
      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setReceipt(null)}
        >
          <div
            className={`max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${t.panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b px-5 py-3 ${t.divide.replace("divide", "border")}`}>
              <div>
                <div className="text-sm font-medium">{receipt.shop_name}</div>
                <div className={`text-xs ${t.faint}`}>
                  {money(receipt.amount)}
                </div>
              </div>
              <button onClick={() => setReceipt(null)} className={`rounded-lg p-1.5 ${t.hover}`}>
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-auto bg-neutral-950 p-3 flex justify-center items-center min-h-[300px]">
              <img
                src={receipt.proof_url} 
                alt="Payment proof"
                className="mx-auto w-full rounded-lg object-contain"
              />
            </div>

            <div className={`grid grid-cols-2 gap-2 border-t p-3 ${t.divide.replace("divide", "border")}`}>
              <button
                onClick={() => decideProof(receipt.id, "verified")}
                disabled={loadingAction}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 size={15} /> Verify Payment
              </button>
              <button
                onClick={() => decideProof(receipt.id, "rejected")}
                disabled={loadingAction}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm text-red-500 hover:bg-red-500/10 ${t.panel} disabled:opacity-50`}
              >
                <XCircle size={15} /> Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- customer drawer ---------------- */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <aside
            className={`h-full w-full max-w-md overflow-y-auto border-l flex flex-col ${t.panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 flex items-start justify-between border-b px-5 py-4 z-10 ${t.panel} ${t.divide.replace("divide", "border")}`}>
              <div>
                <h2 className="text-base font-semibold tracking-tight">{selected.shop_name}</h2>
                <p className={`text-xs ${t.faint}`}>{selected.phone} · {selected.owner_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className={`rounded-lg p-1.5 ${t.hover}`}>
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <div>
                <div className={`text-[11px] uppercase tracking-widest ${t.faint}`}>Outstanding</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{money(selected.total_outstanding)}</div>
              </div>
              <div>
                <div className={`text-[11px] uppercase tracking-widest ${t.faint}`}>Days Overdue</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{selected.days_overdue || 0}</div>
              </div>
            </div>

            <div className="px-5 pb-4">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                <Phone size={15} /> Take Over &amp; Call
              </button>
            </div>

            <div className={`border-t px-5 py-4 flex-1 ${t.divide.replace("divide", "border")}`}>
              <h3 className={`mb-3 text-[11px] uppercase tracking-widest ${t.faint}`}>Interaction Timeline</h3>
              {loadingTimeline ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
              ) : (
                <ol className="space-y-4">
                  {timeline.map((i) => (
                    <li key={i.id} className="relative pl-5">
                      <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${i.color}`} />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium capitalize">{i.title}</span>
                        <span className={`text-[11px] ${t.faint}`}>{dt(i.occurred_at)}</span>
                      </div>
                      <p className={`mt-1 text-sm leading-snug ${t.sub}`}>{i.body}</p>
                      <p className={`mt-0.5 text-[11px] ${t.faint}`}>
                        {i.actor}
                        {i.meta ? ` · ${i.meta}` : ""}
                      </p>
                    </li>
                  ))}
                  {!timeline.length && (
                    <li className={`text-sm ${t.faint}`}>No interactions recorded yet.</li>
                  )}
                </ol>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
