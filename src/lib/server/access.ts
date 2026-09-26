import 'server-only';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {authClient,adminClient,appUrl} from './supabase';
import {hasRole,type Role} from '../security';
export class HttpError extends Error {constructor(public status:number, message:string){super(message);}}
export async function identity(){const db=await authClient();const {data,error}=await db.auth.getUser();if(error||!data.user)throw new HttpError(401,'Log opnieuw in.');return {db,user:data.user};}
export async function workspace(roles:Role[]=['OWNER','ADMIN','MEMBER']) {
 const {db,user}=await identity();
 const selected=(await cookies()).get('mavix-workspace')?.value;
 let query=db.from('workspace_members').select('workspace_id,role').eq('user_id',user.id).order('created_at');
 if(selected)query=query.eq('workspace_id',selected);
 const {data,error}=await query.limit(1).maybeSingle();
 if(error||!data)throw new HttpError(403,'Geen toegang tot deze werkruimte.');
 const {data:active,error:workspaceError}=await db.from('workspaces').select('id').eq('id',data.workspace_id).is('deleted_at',null).maybeSingle();
 if(workspaceError||!active)throw new HttpError(403,'Geen toegang tot deze werkruimte.');
 if(!hasRole(data.role as Role,roles))throw new HttpError(403,'Je hebt geen toestemming voor deze actie.');
 return {db,user,workspaceId:data.workspace_id as string,role:data.role as Role};
}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==appUrl())throw new HttpError(403,'Ongeldige aanvraag.');}
export async function limited(key:string,limit=20){const {data,error}=await adminClient().rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_window:60});if(error)throw new HttpError(503,'Probeer het later opnieuw.');if(!data)throw new HttpError(429,'Te veel aanvragen. Probeer het later opnieuw.');}
export async function audit(workspaceId:string,userId:string,event:string){const {error}=await adminClient().from('audit_logs').insert({workspace_id:workspaceId,actor_id:userId,event});if(error)throw new HttpError(503,'Actie kon niet worden geregistreerd.');}
export function failure(error:unknown){const known=error instanceof HttpError;console.error(JSON.stringify({event:'request_failed',code:known?error.status:503}));return NextResponse.json({error:known?error.message:'Deze functie is nog niet beschikbaar. Controleer de configuratie.'},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});}
