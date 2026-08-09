const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function debugAll() {
  console.log("=== SUPABASE DIAGNOSTIC ===");
  
  const tables = ['customers', 'invoices', 'payments', 'calls', 'payment_promises', 'flags'];
  
  for (const table of tables) {
    console.log(`\nTesting table: ${table}...`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.error(`❌ ERROR on ${table}:`, error.message);
      if (error.hint) console.error(`Hint:`, error.hint);
      if (error.details) console.error(`Details:`, error.details);
    } else {
      console.log(`✅ SUCCESS on ${table}. Found ${data.length} rows.`);
      if (data.length > 0) {
         console.log("Columns:", Object.keys(data[0]).join(', '));
      } else {
         console.log("Table is completely empty (0 rows returned). If there is data, RLS (Row Level Security) might be blocking access.");
      }
    }
  }
}

debugAll();
