import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Akan terlihat di console browser kalau env var belum di-setting di Vercel.
  console.warn(
    "Supabase belum terkoneksi: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum di-set."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
