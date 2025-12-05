const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ SUPABASE_URL o SUPABASE_KEY no están definidas en .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
