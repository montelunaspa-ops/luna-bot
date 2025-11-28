// supabase.js — versión FINAL usando SUPABASE_KEY
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY; // <── ESTA ES LA QUE TIENES EN RENDER

if (!url) {
  console.error("❌ ERROR: Falta SUPABASE_URL en Render.");
}

if (!key) {
  console.error("❌ ERROR: Falta SUPABASE_KEY en Render.");
}

export const supabase = createClient(url, key);
