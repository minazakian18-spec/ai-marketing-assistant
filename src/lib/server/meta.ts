import 'server-only';
import {adminClient,appUrl} from './supabase';
import {HttpError} from './access';
import {encrypt,decrypt} from './crypto';
import {mapMetaError,type Channel} from '../inbox/core';

// Meta channels for the Inbox:
// - Instagram DMs via "Instagram API with Facebook Login": Facebook Login for
//   Business (configuration META_INSTAGRAM_CONFIG_ID, User access token type),
//   then the Page access token of the Page linked to the professional account
//   (graph.facebook.com, /{page-id}/messages). Connections made earlier with
//   "Business Login for Instagram" (graph.instagram.com, INSTAGRAM_APP_ID)
//   keep working; that flow is only offered when no configuration id is set.
// - Messenger via Facebook Login + a Facebook Page access token.
// - WhatsApp via the Cloud API with a system-user token the workspace owner
//   enters in Mavix (stored encrypted; Embedded Signup is the production path).
// Tokens never leave the server.

export type MetaProvider='instagram'|'messenger'|'whatsapp';
export const metaScopes={
 instagram:['instagram_business_basic','instagram_business_manage_messages'],
 messenger:['pages_show_list','pages_manage_metadata','pages_messaging'],
 // Required for Instagram DMs with Facebook Login. The configuration may grant
 // more (instagram_content_publish, pages_read_engagement, business_management).
 instagramFacebook:['instagram_basic','instagram_manage_messages','pages_show_list','pages_manage_metadata'],
};
// Which Instagram login new connections use.
export const instagramMode=():'facebook'|'instagram'=>process.env.INSTAGRAM_APP_ID&&!process.env.META_INSTAGRAM_CONFIG_ID?'instagram':'facebook';
const version=()=>/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||'')?process.env.META_GRAPH_VERSION!:'v25.0';
export const graph=(path:string)=>'https://graph.facebook.com/'+version()+path;
export const igGraph=(path:string)=>'https://graph.instagram.com/'+version()+path;
export const metaCallback=(provider:'instagram'|'messenger')=>appUrl()+'/api/integrations/'+provider+'/callback';

// Names (never values) of the environment variables a channel still needs.
// Only for server logs; customers get a generic Dutch message.
export function missingMetaConfig(provider:MetaProvider){
 const need=['OAUTH_ENCRYPTION_KEY',...(provider==='instagram'?(instagramMode()==='facebook'?['META_CLIENT_ID','META_CLIENT_SECRET','META_INSTAGRAM_CONFIG_ID','META_WEBHOOK_VERIFY_TOKEN']:['INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET']):provider==='messenger'?['META_CLIENT_ID','META_CLIENT_SECRET']:['META_CLIENT_SECRET','META_WEBHOOK_VERIFY_TOKEN'])];
 return need.filter(n=>!process.env[n]);
}
export const metaConfigured=(provider:MetaProvider)=>missingMetaConfig(provider).length===0;
// Webhook signatures: Page, WhatsApp and Instagram-with-Facebook-Login events
// are signed with the Meta app secret; Instagram events of the older Business
// Login for Instagram with the Instagram app secret. "instagram" events are
// accepted with either, so both kinds of connection keep working.
export const webhookSecrets=(object:string)=>(object==='instagram'?[process.env.META_CLIENT_SECRET,process.env.INSTAGRAM_APP_SECRET]:[process.env.META_CLIENT_SECRET]).filter((s):s is string=>!!s);

export type MetaCredentials={access_token:string;user_token?:string;obtained_at?:number;page_id?:string};
// Instagram connections made with Facebook Login: Page token, Page id in metadata.
const viaFacebook=(c:{metadata?:unknown})=>(c.metadata as {authMode?:string}|null)?.authMode==='facebook';

async function metaJson(url:string,init:RequestInit={},channel:Channel='messenger'){
 const r=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=mapMetaError(r.status,data?.error,channel);throw Object.assign(new HttpError(e.status,e.message),{provider:e});}
 return data;
}

export function authorizeUrl(provider:'instagram'|'messenger',state:string){
 // Facebook Login for Business: the configuration decides the permissions and
 // token type, so no scope is sent.
 if(provider==='instagram'&&instagramMode()==='facebook'){const u=new URL('https://www.facebook.com/'+version()+'/dialog/oauth');u.search=new URLSearchParams({client_id:process.env.META_CLIENT_ID!,config_id:process.env.META_INSTAGRAM_CONFIG_ID!,redirect_uri:metaCallback('instagram'),response_type:'code',state}).toString();return u.toString();}
 if(provider==='instagram'){const u=new URL('https://www.instagram.com/oauth/authorize');u.search=new URLSearchParams({client_id:process.env.INSTAGRAM_APP_ID!,redirect_uri:metaCallback('instagram'),response_type:'code',scope:metaScopes.instagram.join(','),state}).toString();return u.toString();}
 const u=new URL('https://www.facebook.com/'+version()+'/dialog/oauth');u.search=new URLSearchParams({client_id:process.env.META_CLIENT_ID!,redirect_uri:metaCallback('messenger'),response_type:'code',scope:metaScopes.messenger.join(','),state}).toString();return u.toString();
}

// Instagram: code -> short-lived token -> long-lived (60 days) token, then the
// professional account id webhooks use (entry.id) and a messages subscription.
export async function completeInstagram(code:string){
 const r=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.INSTAGRAM_APP_ID!,client_secret:process.env.INSTAGRAM_APP_SECRET!,grant_type:'authorization_code',redirect_uri:metaCallback('instagram'),code}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const raw=await r.json().catch(()=>({}));
 if(!r.ok)throw new HttpError(502,'Instagram-autorisatie is geweigerd of verlopen. Probeer opnieuw.');
 const short=(Array.isArray(raw.data)?raw.data[0]:raw) as {access_token?:string;permissions?:string|string[]};
 if(!short?.access_token)throw new HttpError(502,'Instagram gaf geen toegang terug.');
 const granted=(Array.isArray(short.permissions)?short.permissions:String(short.permissions||'').split(',')).map(s=>s.trim()).filter(Boolean);
 const long=await metaJson('https://graph.instagram.com/access_token?'+new URLSearchParams({grant_type:'ig_exchange_token',client_secret:process.env.INSTAGRAM_APP_SECRET!,access_token:short.access_token}),{},'instagram');
 const token=long.access_token as string;
 const me=await metaJson(igGraph('/me?fields=user_id,username,name'),{headers:{Authorization:'Bearer '+token}},'instagram');
 const missing=metaScopes.instagram.filter(s=>granted.length&&!granted.includes(s));
 if(missing.length)throw new HttpError(403,'Geef Mavix toegang tot je Instagram-berichten om de Inbox te gebruiken.');
 await metaJson(igGraph('/me/subscribed_apps?subscribed_fields=messages'),{method:'POST',headers:{Authorization:'Bearer '+token}},'instagram');
 return {token,expiresIn:Number(long.expires_in)||5184000,accountId:String(me.user_id||me.id),name:me.username?'@'+me.username:String(me.name||'Instagram'),granted:granted.length?granted:metaScopes.instagram};
}

// Instagram with Facebook Login for Business: code -> User access token. The
// token is inspected with debug_token before anything is stored: it must be a
// USER token issued to this app (a configuration with the System-user token
// type is refused, never used silently) and carry the required permissions.
// Then the long-lived (60 days) user token; Page tokens derived from it do not
// expire, but access ends at data_access_expires_at or when the user revokes it.
export class InstagramTokenTypeError extends HttpError{constructor(public tokenType:string){super(400,'De Meta-configuratie voor Instagram gebruikt een verkeerd tokentype. Mavix heeft een configuratie met "User access token" nodig.');}}
export async function completeInstagramFacebook(code:string){
 const appId=process.env.META_CLIENT_ID!,secret=process.env.META_CLIENT_SECRET!;
 const short=await metaJson(graph('/oauth/access_token?'+new URLSearchParams({client_id:appId,client_secret:secret,redirect_uri:metaCallback('instagram'),code})),{},'instagram').catch(e=>{throw e instanceof HttpError&&!(e as {provider?:{retryable?:boolean}}).provider?.retryable?new HttpError(400,'De Instagram-autorisatie is verlopen of al gebruikt. Probeer opnieuw.'):e;});
 if(typeof short.access_token!=='string'||!short.access_token)throw new HttpError(502,'Meta gaf geen toegang terug.');
 const info=(await metaJson(graph('/debug_token?'+new URLSearchParams({input_token:short.access_token,access_token:appId+'|'+secret})),{},'instagram')).data as {app_id?:string;type?:string;is_valid?:boolean;scopes?:string[];data_access_expires_at?:number}|undefined;
 if(!info?.is_valid||String(info.app_id)!==appId)throw new HttpError(400,'De Instagram-autorisatie kon niet worden gecontroleerd. Probeer opnieuw.');
 if(info.type!=='USER')throw new InstagramTokenTypeError(String(info.type||'unknown'));
 const granted=Array.isArray(info.scopes)?info.scopes.map(String):[];
 if(metaScopes.instagramFacebook.some(s=>!granted.includes(s)))throw new HttpError(403,'Geef Mavix toegang tot je Instagram-account, berichten en gekoppelde Facebook-pagina.');
 const long=await metaJson(graph('/oauth/access_token?'+new URLSearchParams({grant_type:'fb_exchange_token',client_id:appId,client_secret:secret,fb_exchange_token:short.access_token})),{},'instagram');
 const userToken=String(long.access_token||'');
 if(!userToken)throw new HttpError(502,'Meta gaf geen blijvende toegang terug.');
 const dataAccess=Number(info.data_access_expires_at)||0;
 return {userToken,granted,dataAccessExpiresAt:dataAccess>0?new Date(dataAccess*1000).toISOString():null};
}

export type InstagramAccount={id:string;username:string;name:string;pageId:string;pageName:string;pageToken:string};
// Professional Instagram accounts reachable through the user's Pages: the Page
// must be linked to an Instagram Business/Creator account and the user must be
// allowed to handle its messages (MESSAGING task).
export async function listInstagramAccounts(userToken:string):Promise<InstagramAccount[]>{
 const out:InstagramAccount[]=[];
 type Page={id:string;name?:string;access_token?:string;tasks?:string[];instagram_business_account?:{id?:string;username?:string;name?:string}};
 let url:string|undefined=graph('/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username,name}&limit=100');
 for(let i=0;url&&i<5;i++){
  const d:{data?:Page[];paging?:{next?:string}}=await metaJson(url,{headers:{Authorization:'Bearer '+userToken}},'instagram');
  for(const p of d.data||[]){
   const ig=p.instagram_business_account;
   if(!ig?.id||!/^\d{1,30}$/.test(String(ig.id))||!/^\d{1,30}$/.test(String(p.id))||!p.access_token)continue;
   if(p.tasks&&!p.tasks.includes('MESSAGING')&&!p.tasks.includes('MANAGE'))continue;
   out.push({id:String(ig.id),username:String(ig.username||'').slice(0,100),name:String(ig.name||'').slice(0,200),pageId:String(p.id),pageName:String(p.name||'').slice(0,200),pageToken:p.access_token});
  }
  url=d.paging?.next&&d.paging.next.startsWith('https://graph.facebook.com/')?d.paging.next:undefined;
 }
 return out;
}

export const INSTAGRAM_TAKEN='Dit Instagram-account is al gekoppeld aan een andere Mavix-werkruimte. Ontkoppel het daar eerst.';
// One Instagram account per workspace: webhooks are routed by its id. The
// unique index of 202610080002_instagram_unique_account.sql enforces this
// under concurrent requests (unique violation -> 409 as well).
async function assertInstagramFree(workspaceId:string,igId:string){
 const {data,error}=await adminClient().from('integration_connections').select('workspace_id').eq('provider','instagram').eq('provider_account_id',igId).neq('workspace_id',workspaceId).neq('status','disconnected').limit(1);
 if(error)throw error;
 if(data?.length)throw new HttpError(409,INSTAGRAM_TAKEN);
}

// Choose the Instagram account for a workspace. The id from the browser is
// only used to look the account up again, live, with this workspace's own
// user token; nothing is stored unless Meta returns it.
export async function selectInstagramAccount(workspaceId:string,igId:string){
 const db=adminClient();
 const {data:c}=await db.from('integration_connections').select('id,encrypted_credentials,metadata').eq('workspace_id',workspaceId).eq('provider','instagram').maybeSingle();
 if(!c?.encrypted_credentials||!viaFacebook(c))throw new HttpError(409,'Verbind eerst Instagram via Facebook.');
 const creds=decrypt<MetaCredentials>(c.encrypted_credentials,workspaceId+':instagram');
 if(!creds.user_token)throw new HttpError(409,'Verbind Instagram opnieuw om een ander account te kiezen.');
 const account=(await listInstagramAccounts(creds.user_token)).find(a=>a.id===igId);
 if(!account)throw new HttpError(403,'Geen toegang tot dit Instagram-account.');
 await assertInstagramFree(workspaceId,account.id);
 // Install the app on the linked Page so Instagram message webhooks arrive.
 await metaJson(graph('/'+account.pageId+'/subscribed_apps?subscribed_fields=messages'),{method:'POST',headers:{Authorization:'Bearer '+account.pageToken}},'instagram').catch(e=>{throw e instanceof HttpError&&!(e as {provider?:{retryable?:boolean}}).provider?.retryable?new HttpError(400,'Mavix kon berichtmeldingen voor de gekoppelde Facebook-pagina niet inschakelen. Controleer of je deze pagina mag beheren.'):e;});
 const {error}=await db.from('integration_connections').update({
  provider_account_id:account.id,
  display_name:account.username?'@'+account.username:account.name||'Instagram',
  status:'connected',
  encrypted_credentials:encrypt({access_token:account.pageToken,user_token:creds.user_token,page_id:account.pageId,obtained_at:Date.now()},workspaceId+':instagram'),
  metadata:{authMode:'facebook',pageId:account.pageId,pageName:account.pageName,username:account.username},
 }).eq('id',c.id);
 if(error?.code==='23505')throw new HttpError(409,INSTAGRAM_TAKEN);
 if(error)throw error;
 return account.username?'@'+account.username:account.name;
}

// Messenger: code -> user token -> long-lived user token; the Page is chosen
// afterwards (automatically when there is exactly one).
export async function completeMessenger(code:string){
 const short=await metaJson(graph('/oauth/access_token?'+new URLSearchParams({client_id:process.env.META_CLIENT_ID!,client_secret:process.env.META_CLIENT_SECRET!,redirect_uri:metaCallback('messenger'),code})));
 const long=await metaJson(graph('/oauth/access_token?'+new URLSearchParams({grant_type:'fb_exchange_token',client_id:process.env.META_CLIENT_ID!,client_secret:process.env.META_CLIENT_SECRET!,fb_exchange_token:short.access_token})));
 const perms=await metaJson(graph('/me/permissions'),{headers:{Authorization:'Bearer '+long.access_token}});
 const granted=(perms.data||[]).filter((p:{status?:string})=>p.status==='granted').map((p:{permission:string})=>p.permission);
 if(metaScopes.messenger.some(s=>!granted.includes(s)))throw new HttpError(403,'Geef Mavix toegang tot je Facebook-pagina en Messenger-berichten.');
 const me=await metaJson(graph('/me?fields=id,name'),{headers:{Authorization:'Bearer '+long.access_token}});
 return {userToken:long.access_token as string,userId:String(me.id),userName:String(me.name||''),granted};
}

export async function listPages(userToken:string){
 const pages:{id:string;name:string;access_token:string;tasks?:string[]}[]=[];
 let url:string|undefined=graph('/me/accounts?fields=id,name,access_token,tasks&limit=100');
 for(let i=0;url&&i<5;i++){const d:{data?:typeof pages;paging?:{next?:string}}=await metaJson(url,{headers:{Authorization:'Bearer '+userToken}});pages.push(...(d.data||[]));url=d.paging?.next&&d.paging.next.startsWith('https://graph.facebook.com/')?d.paging.next:undefined;}
 // Replying needs the MESSAGING task on the Page.
 return pages.filter(p=>!p.tasks||p.tasks.includes('MESSAGING')||p.tasks.includes('MANAGE'));
}

export async function selectPage(workspaceId:string,pageId:string){
 const db=adminClient();
 const {data:c}=await db.from('integration_connections').select('id,encrypted_credentials').eq('workspace_id',workspaceId).eq('provider','messenger').single();
 if(!c?.encrypted_credentials)throw new HttpError(409,'Verbind eerst Facebook.');
 const creds=decrypt<MetaCredentials>(c.encrypted_credentials,workspaceId+':messenger');
 const page=(await listPages(creds.user_token||creds.access_token)).find(p=>p.id===pageId);
 if(!page)throw new HttpError(403,'Geen toegang tot deze pagina.');
 await metaJson(graph('/'+page.id+'/subscribed_apps?subscribed_fields=messages,message_echoes,message_deliveries,message_reads'),{method:'POST',headers:{Authorization:'Bearer '+page.access_token}});
 const {error}=await db.from('integration_connections').update({provider_account_id:page.id,display_name:page.name,status:'connected',encrypted_credentials:encrypt({access_token:page.access_token,obtained_at:Date.now()},workspaceId+':messenger'),expires_at:null,metadata:{}}).eq('id',c.id);
 if(error)throw error;
 return page.name;
}

// WhatsApp: the number must be one of the phone numbers Meta lists for the
// given WhatsApp Business Account (read with the supplied token). Nothing is
// subscribed or stored before this check passes.
type WaInput={phoneNumberId:string;wabaId:string;token:string};
const invalidInput=(e:unknown)=>e instanceof HttpError&&e.status!==429&&!(e as {provider?:{retryable?:boolean}}).provider?.retryable;
export async function verifyWhatsAppNumber(input:WaInput){
 const auth={headers:{Authorization:'Bearer '+input.token}};
 // Temporary Meta problems (rate limits, 5xx) keep their own message; anything
 // else means the IDs or the token's access are wrong.
 const rethrow=(message:string)=>(e:unknown)=>{throw invalidInput(e)?new HttpError(400,message):e;};
 let url:string|undefined=graph('/'+input.wabaId+'/phone_numbers?fields=id,display_phone_number,verified_name&limit=100');
 for(let i=0;url&&i<5;i++){
  const d:{data?:{id?:string;display_phone_number?:string;verified_name?:string}[];paging?:{next?:string}}=await metaJson(url,auth,'whatsapp').catch(rethrow('Mavix kon dit WhatsApp Business-account niet controleren. Controleer de WABA ID en of het token toegang heeft (whatsapp_business_management).'));
  const number=(d.data||[]).find(n=>String(n.id)===input.phoneNumberId);
  if(number)return {display:String(number.verified_name||number.display_phone_number||'WhatsApp'),phone:String(number.display_phone_number||'')};
  url=d.paging?.next&&d.paging.next.startsWith('https://graph.facebook.com/')?d.paging.next:undefined;
 }
 throw new HttpError(400,'Deze Phone Number ID hoort niet bij het opgegeven WhatsApp Business-account. Controleer beide ID\'s in WhatsApp Manager.');
}
// Subscribe the Meta app to the WhatsApp Business Account's webhooks.
export async function subscribeWhatsApp(input:WaInput){
 await metaJson(graph('/'+input.wabaId+'/subscribed_apps'),{method:'POST',headers:{Authorization:'Bearer '+input.token}},'whatsapp').catch(e=>{throw invalidInput(e)?new HttpError(400,'Mavix kon zich niet abonneren op dit WhatsApp Business-account. Controleer de rechten van het token.'):e;});
}

// Decrypted credentials for a Meta connection. Instagram long-lived tokens
// are refreshed when they are older than a day and expire within 10 days.
export async function metaConnection(workspaceId:string,provider:MetaProvider){
 const db=adminClient();
 const {data:c,error}=await db.from('integration_connections').select('*').eq('workspace_id',workspaceId).eq('provider',provider).single();
 if(error||!c?.encrypted_credentials||c.status==='disconnected')throw new HttpError(409,'Verbind eerst dit kanaal.');
 if(c.status==='reconnect_required')throw new HttpError(409,'Verbind dit kanaal opnieuw.');
 if(c.status==='selection_required'||!c.provider_account_id)throw new HttpError(409,'Kies eerst welk account Mavix gebruikt.');
 let creds=decrypt<MetaCredentials>(c.encrypted_credentials,workspaceId+':'+provider);
 // Facebook Login: the Page token does not expire by itself; Meta's data
 // access for the user does (expires_at). After that, reconnect.
 if(provider==='instagram'&&viaFacebook(c)){
  if(c.expires_at&&new Date(c.expires_at).getTime()<=Date.now()){await db.from('integration_connections').update({status:'reconnect_required'}).eq('id',c.id);throw new HttpError(409,'De Instagram-koppeling is verlopen. Verbind opnieuw.');}
  return {creds,c};
 }
 if(provider==='instagram'&&c.expires_at){
  const left=new Date(c.expires_at).getTime()-Date.now();
  if(left<=0){await db.from('integration_connections').update({status:'reconnect_required'}).eq('id',c.id);throw new HttpError(409,'De Instagram-koppeling is verlopen. Verbind opnieuw.');}
  if(left<10*86400000&&Date.now()-(creds.obtained_at||0)>86400000){
   try{const r=await metaJson('https://graph.instagram.com/refresh_access_token?'+new URLSearchParams({grant_type:'ig_refresh_token',access_token:creds.access_token}),{},'instagram');creds={access_token:r.access_token,obtained_at:Date.now()};await db.from('integration_connections').update({encrypted_credentials:encrypt(creds,workspaceId+':'+provider),expires_at:new Date(Date.now()+(Number(r.expires_in)||5184000)*1000).toISOString()}).eq('id',c.id);}catch{/* keep using the current token until it expires */}
  }
 }
 return {creds,c};
}

async function flag(id:string,e:unknown){const p=(e as {provider?:{connection?:string}})?.provider;if(p?.connection)await adminClient().from('integration_connections').update({status:p.connection}).eq('id',id);}

// Send a text reply; returns the provider message id.
export async function sendMetaText(workspaceId:string,provider:MetaProvider,recipient:string,text:string):Promise<string>{
 const {creds,c}=await metaConnection(workspaceId,provider);
 const headers={Authorization:'Bearer '+creds.access_token,'Content-Type':'application/json'};
 try{
  // Instagram with Facebook Login: same /{page-id}/messages endpoint as
  // Messenger, Page token, Instagram-scoped id (IGSID) as recipient.
  if(provider==='instagram'&&viaFacebook(c)){const pageId=String((c.metadata as {pageId?:string}).pageId||creds.page_id||'');if(!/^\d{1,30}$/.test(pageId))throw new HttpError(409,'Verbind Instagram opnieuw.');const d=await metaJson(graph('/'+pageId+'/messages'),{method:'POST',headers,body:JSON.stringify({recipient:{id:recipient},messaging_type:'RESPONSE',message:{text}})},'instagram');return String(d.message_id);}
  if(provider==='instagram'){const d=await metaJson(igGraph('/me/messages'),{method:'POST',headers,body:JSON.stringify({recipient:{id:recipient},message:{text}})},'instagram');return String(d.message_id);}
  if(provider==='messenger'){const d=await metaJson(graph('/'+c.provider_account_id+'/messages'),{method:'POST',headers,body:JSON.stringify({recipient:{id:recipient},messaging_type:'RESPONSE',message:{text}})},'messenger');return String(d.message_id);}
  const d=await metaJson(graph('/'+c.provider_account_id+'/messages'),{method:'POST',headers,body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:recipient,type:'text',text:{body:text,preview_url:false}})},'whatsapp');
  return String(d.messages?.[0]?.id);
 }catch(e){await flag(c.id,e);throw e;}
}

export type Template={name:string;language:string;body:string;variables:number};
export async function whatsappTemplates(workspaceId:string):Promise<Template[]>{
 const {creds,c}=await metaConnection(workspaceId,'whatsapp');
 const waba=(c.metadata as {wabaId?:string})?.wabaId;if(!waba)return [];
 const d=await metaJson(graph('/'+waba+'/message_templates?fields=name,language,status,components&limit=100'),{headers:{Authorization:'Bearer '+creds.access_token}},'whatsapp');
 return (d.data||[]).filter((t:{status?:string})=>t.status==='APPROVED').map((t:{name:string;language:string;components?:{type?:string;text?:string;format?:string}[]})=>{const body=t.components?.find(x=>x.type==='BODY')?.text||'';const header=t.components?.find(x=>x.type==='HEADER');return header&&header.format&&header.format!=='TEXT'?null:{name:t.name,language:t.language,body,variables:(body.match(/\{\{\d+\}\}/g)||[]).length};}).filter(Boolean);
}
export async function sendWhatsAppTemplate(workspaceId:string,to:string,template:{name:string;language:string;variables:string[]}):Promise<string>{
 const {creds,c}=await metaConnection(workspaceId,'whatsapp');
 const components=template.variables.length?[{type:'body',parameters:template.variables.map(text=>({type:'text',text}))}]:undefined;
 try{const d=await metaJson(graph('/'+c.provider_account_id+'/messages'),{method:'POST',headers:{Authorization:'Bearer '+creds.access_token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',template:{name:template.name,language:{code:template.language},...(components?{components}:{})}})},'whatsapp');return String(d.messages?.[0]?.id);}
 catch(e){await flag(c.id,e);throw e;}
}

// WhatsApp media: resolve the media id to a short-lived URL, then download it
// with the token. Only for the authenticated attachment proxy.
export async function whatsappMedia(workspaceId:string,mediaId:string){
 if(!/^\d{1,40}$/.test(mediaId))throw new HttpError(400,'Ongeldige bijlage.');
 const {creds}=await metaConnection(workspaceId,'whatsapp');
 const meta=await metaJson(graph('/'+mediaId),{headers:{Authorization:'Bearer '+creds.access_token}},'whatsapp');
 if(Number(meta.file_size)>25*1024*1024)throw new HttpError(413,'Deze bijlage is te groot om te tonen.');
 const url=new URL(String(meta.url));
 if(url.protocol!=='https:'||!/(^|\.)(fbcdn\.net|whatsapp\.net|facebook\.com|fbsbx\.com)$/.test(url.hostname))throw new HttpError(502,'Onverwachte bijlagelocatie.');
 const r=await fetch(url,{headers:{Authorization:'Bearer '+creds.access_token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new HttpError(502,'De bijlage kon niet worden opgehaald.');
 return {data:Buffer.from(await r.arrayBuffer()),mimeType:String(meta.mime_type||'application/octet-stream')};
}

// Best-effort customer profile for a new conversation (name/username).
export async function metaProfile(workspaceId:string,provider:'instagram'|'messenger',id:string){
 try{
  if(!/^\d{1,40}$/.test(id))return {};
  const {creds,c}=await metaConnection(workspaceId,provider);
  // Instagram user profile: graph.facebook.com with the Page token when
  // connected through Facebook Login.
  const url=provider==='instagram'?(viaFacebook(c)?graph:igGraph)('/'+id+'?fields=name,username'):graph('/'+id+'?fields=first_name,last_name,name');
  const d=await metaJson(url,{headers:{Authorization:'Bearer '+creds.access_token}},provider);
  return {name:typeof d.name==='string'?d.name.slice(0,200):[d.first_name,d.last_name].filter(Boolean).join(' ').slice(0,200)||undefined,username:typeof d.username==='string'?d.username.slice(0,100):undefined};
 }catch{return {};}
}
