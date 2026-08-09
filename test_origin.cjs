const fs = require('fs');

async function testOrigin() {
  const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf-8') : '';
  const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  
  const baseUrl = urlMatch ? urlMatch[1].trim() : "https://iuzzvdmkasimulbvpnhh.supabase.co";
  const url = `${baseUrl}/rest/v1/customers?select=*`;
  const key = keyMatch ? keyMatch[1].trim() : process.env.VITE_SUPABASE_ANON_KEY || "";

  console.log("1. Testing WITHOUT Origin header (like Node.js)...");
  const res1 = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log("Status 1:", res1.status);

  console.log("2. Testing WITH Origin header (like Browser)...");
  const res2 = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Origin': 'http://localhost:5173'
    }
  });
  console.log("Status 2:", res2.status);
  
  if (res2.status === 401) {
    const text = await res2.text();
    console.log("Body 2:", text);
  }
}

testOrigin();
