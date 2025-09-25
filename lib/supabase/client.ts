import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      flowType: "pkce", // Enable PKCE flow for OAuth providers like Microsoft
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
}
