import {DEMO_COOKIE, demoSession} from '@/lib/demo';
import {supabaseUrl,supabasePublicKey} from '@/lib/supabase-config';
import {requiresAuthentication} from '@/lib/security';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
// Public marketing pages need no session work: skipping the Supabase call
// keeps them fast (TTFB) and cacheable for visitors and search engines.
const isPublic=(p:string)=>p==='/'||p==='/pricing'||p.startsWith('/legal/');
export async function proxy(request:NextRequest) {
 let response=NextResponse.next({request});
 if(isPublic(request.nextUrl.pathname)&&!demoSession(request.cookies.get(DEMO_COOKIE)?.value,process.env.NODE_ENV))return response;
 if(demoSession(request.cookies.get(DEMO_COOKIE)?.value,process.env.NODE_ENV)) {
  if(request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({error:'Deze functie vereist een echt account. In de testmodus worden alleen lokale voorbeeldgegevens gebruikt.'},{status:403});
  response.headers.set('Cache-Control','private, no-store');
  return response;
 }
 if(!supabaseUrl()||!supabasePublicKey()){if(requiresAuthentication(request.nextUrl.pathname))return NextResponse.redirect(new URL('/login?setup=required',request.url));return response;}
 const db=createServerClient(supabaseUrl(),supabasePublicKey(),{cookieOptions:{httpOnly:true,secure:process.env.APP_URL?.startsWith('https:'),sameSite:'lax',path:'/'},cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{for(const c of values)request.cookies.set(c.name,c.value);response=NextResponse.next({request});for(const c of values)response.cookies.set(c.name,c.value,c.options);}}});
 const {data}=await db.auth.getUser();
 if(!data.user&&requiresAuthentication(request.nextUrl.pathname)){const redirect=NextResponse.redirect(new URL('/login',request.url));for(const c of response.cookies.getAll())redirect.cookies.set(c);return redirect;}
 if(data.user && ['/login','/register'].includes(request.nextUrl.pathname)){const redirect=NextResponse.redirect(new URL('/dashboard',request.url));for(const c of response.cookies.getAll())redirect.cookies.set(c);return redirect;}
 response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|.*\\.(?:svg|png|jpg|webp|ico)$).*)']};
