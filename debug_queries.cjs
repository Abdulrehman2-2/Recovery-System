const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function debugQueries() {
  const results = await Promise.all([
    supabase.from("customers").select("*").order("priority", { ascending: false }),
    supabase.from("payments").select("*, customers(shop_name), invoices(invoice_number)").eq("status", "pending").order("submitted_at", { ascending: false }),
    supabase.from("calls").select("*", { count: "exact", head: true }).gte("started_at", new Date().toISOString().slice(0, 10)),
    supabase.from("flags").select("*").eq("status", "open"),
    supabase.from("payment_promises").select("*"),
    supabase.from("invoices").select("customer_id, due_date").eq("status", "unpaid")
  ]);

  const names = ['CUSTOMERS', 'PAYMENTS', 'CALLS (Count)', 'FLAGS', 'PAYMENT_PROMISES', 'INVOICES'];
  
  const output = {};
  
  results.forEach((res, i) => {
    if (res.error) {
      output[names[i]] = { error: res.error };
    } else {
      output[names[i]] = names[i] === 'CALLS (Count)' ? res.count : res.data;
    }
  });
  
  console.log(JSON.stringify(output, null, 2));
}

debugQueries();
