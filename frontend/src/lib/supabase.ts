import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

/** Returns a user-facing message when Supabase env vars are missing or still placeholders. */
export function getSupabaseConfigError(): string | null {
    if (
        !supabaseUrl ||
        supabaseUrl.includes("your-project.supabase.co")
    ) {
        return "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL in frontend/.env.local to your project URL (Supabase dashboard → Project Settings → API), then restart the frontend dev server.";
    }
    if (
        !supabaseAnonKey ||
        supabaseAnonKey === "your-supabase-anon-key"
    ) {
        return "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in frontend/.env.local to your anon/publishable key (Supabase dashboard → Project Settings → API), then restart the frontend dev server.";
    }
    return null;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
