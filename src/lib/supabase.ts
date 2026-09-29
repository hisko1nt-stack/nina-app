import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const globalForSupabase = globalThis as unknown as {
  ninaSupabase: SupabaseClient | undefined;
};

export const supabase =
  globalForSupabase.ninaSupabase ??
  createClient(supabaseUrl, supabaseKey);

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.ninaSupabase = supabase;
}
