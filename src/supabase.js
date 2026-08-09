import { createClient } from "@supabase/supabase-js";

// Supabase configuration - initialized directly as requested
const SUPABASE_URL = "https://mdwhgilqwvmyxrequuju.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kd2hnaWxxd3ZteXhyZXF1dWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMjcyOTUsImV4cCI6MjEwMTgwMzI5NX0.bcGJGzWcBbz2-ZlyPLOKN_FTvZ3i4D2QlLV4XxnHJ24";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
