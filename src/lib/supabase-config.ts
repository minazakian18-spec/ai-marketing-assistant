// Public connection values only. Never add service-role/secret keys here.
// NEXT_PUBLIC_* (the names documented in .env.example) take priority over
// bare SUPABASE_URL/SUPABASE_ANON_KEY. Some hosts (e.g. a Hostinger database
// add-on) auto-inject the bare names for their own managed instance; if those
// were checked first, they would silently shadow a manually configured
// Supabase project pointing at different credentials/schema.
export const supabaseUrl=()=>process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'';
export const supabasePublicKey=()=>process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
