import { supabase } from "./supabaseClient";

/**
 * Pengganti window.storage (khusus Claude artifact) untuk versi hosting mandiri.
 * Menyimpan data sebagai pasangan key-value di tabel "kv_store" pada Supabase.
 * Lihat README.md untuk cara membuat tabelnya.
 */
export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: data.value };
  },

  async set(key, value) {
    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};
