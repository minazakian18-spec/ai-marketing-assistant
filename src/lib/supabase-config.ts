// Public connection values only. Never add service-role/secret keys here.
export const supabaseUrl=()=>process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'';
export const supabasePublicKey=()=>process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
