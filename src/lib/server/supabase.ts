import {supabaseUrl,supabasePublicKey} from '../supabase-config';
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
export function configured() { return !!(supabaseUrl() && supabasePublicKey()); }
export function appUrl() { const url=new URL(process.env.APP_URL || 'http://localhost:3000'); if(process.env.NODE_ENV==='production'&&url.protocol!=='https:') throw new Error('APP_URL requires HTTPS'); return url.origin; }
export async function authClient() {
 if(!configured())throw new Error('AUTH_SETUP_REQUIRED');
 const jar=await cookies();
 return createServerClient(supabaseUrl(),supabasePublicKey(),{cookieOptions:{httpOnly:true,secure:appUrl().startsWith('https:'),sameSite:'lax',path:'/'},cookies:{getAll:()=>jar.getAll(),setAll:values=>{for(const {name,value,options} of values)try{jar.set(name,value,options);}catch{/* Server components cannot refresh; route handlers handle cookie updates. */}}}});
}
export function adminClient() {if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('DATABASE_SETUP_REQUIRED');return createClient(supabaseUrl(),process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});}
