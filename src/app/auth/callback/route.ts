import {NextResponse} from 'next/server';
import {authClient,appUrl} from '@/lib/server/supabase';
export async function GET(request:Request){const url=new URL(request.url);try{const code=url.searchParams.get('code');if(code){const db=await authClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(url.searchParams.get('next')==='/reset-password'?'/reset-password':'/dashboard',appUrl()));}}catch{/* No provider error or token in redirect. */}return NextResponse.redirect(new URL('/login?session=expired',appUrl()));}
