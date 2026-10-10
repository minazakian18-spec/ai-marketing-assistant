import {authLimit} from '@/lib/server/auth-limit';
import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {authClient,appUrl} from '@/lib/server/supabase';
import {failure,HttpError,sameOrigin} from '@/lib/server/access';
const email=z.string().email().max(254);
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {try {
 sameOrigin(request);const {action}=await params;const body=await request.json();const db=await authClient();
 const bucket=createHash('sha256').update(String(body.email||'anonymous').toLowerCase()).digest('hex');await authLimit('auth:'+action+':'+bucket,5);await authLimit('auth:global',200);
 if(action==='login'){const input=z.object({email,password:z.string().min(1).max(128)}).parse(body);const {error}=await db.auth.signInWithPassword(input);if(error)throw new HttpError(401,'E-mailadres of wachtwoord is onjuist.');return NextResponse.json({redirect:'/dashboard'});}
 // Private beta: sign-up creates a "pending" workspace that a platform admin
 // approves. MAVIX_SIGNUP=closed disables new accounts entirely.
 if(action==='register'&&process.env.MAVIX_SIGNUP==='closed')throw new HttpError(403,'Mavix is in besloten beta. Nieuwe accounts zijn alleen op uitnodiging.');
 if(action==='register'){const input=z.object({email,password:z.string().min(12).max(128),name:z.string().trim().min(1).max(100),businessName:z.string().trim().min(1).max(160)}).parse(body);const {error}=await db.auth.signUp({email:input.email,password:input.password,options:{data:{full_name:input.name,business_name:input.businessName},emailRedirectTo:appUrl()+'/auth/callback'}});if(error?.code==='over_email_send_rate_limit')throw new HttpError(429,'Er zijn tijdelijk te veel bevestigingsmails aangevraagd. Probeer het later opnieuw.');if(error)throw new HttpError(400,'Registratie niet gelukt. Controleer je gegevens of probeer in te loggen.');return NextResponse.json({message:'Controleer je e-mail om je account te bevestigen. Mavix is in besloten beta: na bevestiging beoordelen we je toegang.'});}
 if(action==='forgot'){const input=email.parse(body.email);const {error}=await db.auth.resetPasswordForEmail(input,{redirectTo:appUrl()+'/auth/callback?next=/reset-password'});if(error)throw new HttpError(503,'Aanvragen lukt momenteel niet. Probeer later opnieuw.');return NextResponse.json({message:'Als dit adres bekend is, ontvang je een resetlink.'});}
 if(action==='reset'){const password=z.string().min(12).max(128).parse(body.password);const {data}=await db.auth.getUser();if(!data.user)throw new HttpError(401,'Je resetlink is verlopen. Vraag een nieuwe aan.');const {error}=await db.auth.updateUser({password});if(error)throw new HttpError(400,'Wachtwoord wijzigen is niet gelukt.');const {error:logoutError}=await db.auth.signOut({scope:'global'});if(logoutError)throw new HttpError(503,'Uitloggen is niet gelukt. Probeer opnieuw.');return NextResponse.json({redirect:'/login'});}
 if(action==='logout'){const {error}=await db.auth.signOut({scope:'global'});if(error)throw new HttpError(503,'Uitloggen is niet gelukt. Probeer opnieuw.');return NextResponse.json({redirect:'/login'});}
 if(action==='google'){const {data,error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:appUrl()+'/auth/callback',scopes:'openid email profile',skipBrowserRedirect:true}});if(error||!data.url)throw new HttpError(503,'Google-login is niet beschikbaar.');return NextResponse.json({redirect:data.url});}
 throw new HttpError(404,'Niet gevonden.');
 }catch(e){if(e instanceof z.ZodError)return failure(new HttpError(400,'Controleer de invoer. Gebruik minimaal 12 tekens voor een nieuw wachtwoord.'));return failure(e);}}
