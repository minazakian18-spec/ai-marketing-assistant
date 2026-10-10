import 'server-only';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {authClient,adminClient,appUrl} from './supabase';
import {hasRole,type Role} from '../security';
export class HttpError extends Error {constructor(public status:number, message:string){super(message);}}
export async function identity(){const db=await authClient();const {data,error}=await db.auth.getUser();if(error||!data.user)throw new HttpError(401,'Log opnieuw in.');return {db,user:data.user};}
// Private beta: a signed-in account alone grants nothing. The workspace must be
// approved by a platform administrator (workspaces.access_status). Fails closed
// when the access columns are missing (migration 202610120001 not applied).
export class AccessPendingError extends HttpError {constructor(public access:'pending'|'suspended'){super(403,access==='suspended'?'De toegang van deze werkruimte is gepauzeerd. Neem contact op met Mavix.':'Je account wacht op goedkeuring voor de besloten beta.');}}
export async function workspace(roles:Role[]=['OWNER','ADMIN','MEMBER']) {
 const {db,user}=await identity();
 const selected=(await cookies()).get('mavix-workspace')?.value;
 const {data:memberships,error}=await db.from('workspace_members').select('workspace_id,role').eq('user_id',user.id).order('created_at');
 if(error||!memberships?.length)throw new HttpError(403,'Geen toegang tot deze werkruimte.');
 const ids=memberships.map(m=>m.workspace_id as string);
 const {data:spaces,error:workspaceError}=await db.from('workspaces').select('id,access_status').in('id',ids).is('deleted_at',null);
 if(workspaceError){if(workspaceError.code==='42703'){console.error(JSON.stringify({event:'beta_access_not_provisioned'}));throw new HttpError(503,'Mavix wordt bijgewerkt. Probeer het over enkele minuten opnieuw.');}throw new HttpError(403,'Geen toegang tot deze werkruimte.');}
 const status=new Map((spaces||[]).map(s=>[s.id as string,s.access_status as string]));
 const active=memberships.filter(m=>status.has(m.workspace_id));
 // A selected workspace (switcher cookie) must be one of the caller's own;
 // without a selection the first approved workspace is used.
 const pool=selected?active.filter(m=>m.workspace_id===selected):active;
 if(!pool.length)throw new HttpError(403,'Geen toegang tot deze werkruimte.');
 const chosen=pool.find(m=>status.get(m.workspace_id)==='approved');
 if(!chosen)throw new AccessPendingError(pool.some(m=>status.get(m.workspace_id)==='suspended')?'suspended':'pending');
 if(!hasRole(chosen.role as Role,roles))throw new HttpError(403,'Je hebt geen toestemming voor deze actie.');
 return {db,user,workspaceId:chosen.workspace_id as string,role:chosen.role as Role};
}
// Mavix staff (public.platform_admins), checked with the service role. Never
// derived from an e-mail address or a client-supplied flag.
export async function platformAdmin(){const {user}=await identity();const {data,error}=await adminClient().from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(error||!data)throw new HttpError(403,'Geen toegang.');return {user};}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==appUrl())throw new HttpError(403,'Ongeldige aanvraag.');}
export async function limited(key:string,limit=20){const {data,error}=await adminClient().rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_window:60});if(error)throw new HttpError(503,'Probeer het later opnieuw.');if(!data)throw new HttpError(429,'Te veel aanvragen. Probeer het later opnieuw.');}
export async function audit(workspaceId:string,userId:string,event:string){const {error}=await adminClient().from('audit_logs').insert({workspace_id:workspaceId,actor_id:userId,event});if(error)throw new HttpError(503,'Actie kon niet worden geregistreerd.');}
export function failure(error:unknown){const known=error instanceof HttpError;console.error(JSON.stringify({event:'request_failed',code:known?error.status:503}));return NextResponse.json({error:known?error.message:'Deze functie is nog niet beschikbaar. Probeer het later opnieuw.',...(error instanceof AccessPendingError?{access:error.access}:{})},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});}
