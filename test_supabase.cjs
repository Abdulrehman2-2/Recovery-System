const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function testConnection() {
  console.log("Testing Supabase Connection...");
  console.log("URL:", VITE_SUPABASE_URL);
  
  const { data, error } = await supabase.from('CUSTOMERS').select('*').limit(5);
  
  if (error) {
    console.error("Error fetching CUSTOMERS:");
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log(`Success! Found ${data.length} customers.`);
    if (data.length > 0) {
      console.log("Sample customer:", data[0]);
    }
  }
}

testConnection();
