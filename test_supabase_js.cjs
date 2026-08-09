const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testSupabaseJs() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
  const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

  // Initialize exactly like the browser does
  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log("Fetching customers using supabase-js in Node...");
  const { data, error, status } = await supabase.from('customers').select('*');
  
  if (error) {
    console.error("ERROR:", status, error);
  } else {
    console.log("SUCCESS:", status, "Data length:", data.length);
  }
}

testSupabaseJs();
