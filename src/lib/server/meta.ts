import 'server-only';
import {adminClient,appUrl} from './supabase';
import {HttpError} from './access';
import {encrypt,decrypt} from './crypto';
import {mapMetaError,type Channel} from '../inbox/core';

// Meta channels for the Inbox:
// - Instagram DMs via "Business Login for Instagram" (graph.instagram.com),
//   with the Instagram app id/secret of the Meta app.
// - Messenger via Facebook Login + a Facebook Page access token.
// - WhatsApp via the Cloud API with a system-user token the workspace owner
//   enters in Mavix (stored encrypted; Embedded Signup is the production path).
// Tokens never leave the server.

export type MetaProvider='instagram'|'messenger'|'whatsapp';
export const metaScopes={
 instagram:['instagram_business_basic','instagram_business_manage_messages'],
 messenger:['pages_show_list','pages_manage_metadata','pages_messaging'],
};
const version=()=>/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||'')?process.env.META_GRAPH_VERSION!:'v25.0';
export const graph=(path:string)=>'https://graph.facebook.com/'+version()+path;
export const igGraph=(path:string)=>'https://graph.instagram.com/'+version()+path;
export const metaCallback=(provider:'instagram'|'messenger')=>appUrl()+'/api/integrations/'+provider+'/callback';

export function metaConfigured(provider:MetaProvider){
 if(!process.env.OAUTH_ENCRYPTION_KEY)return false;
 if(provider==='instagram')return !!(process.env.INSTAGRAM_APP_ID&&process.env.INSTAGRAM_APP_SECRET);
 if(provider==='messenger')return !!(process.env.META_CLIENT_ID&&process.env.META_CLIENT_SECRET);
 return !!process.env.META_CLIENT_SECRET;
}
// Webhook signatures: Instagram Business Login events are signed with the
// Instagram app secret, Page and WhatsApp events with the Meta app secret.
export const webhookSecret=(object:string)=>object==='instagram'?(process.env.INSTAGRAM_APP_SECRET||''):(process.env.META_CLIENT_SECRET||'');

export type MetaCredentials={access_token:string;user_token?:string;obtained_at?:number};

async function metaJson(url:string,init:RequestInit={},channel:Channel='messenger'){
 const r=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=mapMetaError(r.status,data?.error,channel);throw Object.assign(new HttpError(e.status,e.message),{provider:e});}
 return data;
}

export function authorizeUrl(provider:'instagram'|'messenger',state:string){
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

// WhatsApp: verify the number with the given token and subscribe the app to
// the WhatsApp Business Account's webhooks.
export async function connectWhatsApp(input:{phoneNumberId:string;wabaId:string;token:string}){
 const auth={headers:{Authorization:'Bearer '+input.token}};
 const number=await metaJson(graph('/'+input.phoneNumberId+'?fields=display_phone_number,verified_name'),auth,'whatsapp').catch(e=>{throw e instanceof HttpError&&e.status!==429?new HttpError(400,'Mavix kon dit WhatsApp-nummer niet controleren. Controleer de Phone Number ID en het token.'):e;});
 await metaJson(graph('/'+input.wabaId+'/subscribed_apps'),{method:'POST',...auth},'whatsapp').catch(e=>{throw e instanceof HttpError&&e.status!==429?new HttpError(400,'Mavix kon zich niet abonneren op dit WhatsApp Business-account. Controleer de WABA ID en de rechten van het token.'):e;});
 return {display:String(number.verified_name||number.display_phone_number||'WhatsApp'),phone:String(number.display_phone_number||'')};
}

// Decrypted credentials for a Meta connection. Instagram long-lived tokens
// are refreshed when they are older than a day and expire within 10 days.
export async function metaConnection(workspaceId:string,provider:MetaProvider){
 const db=adminClient();
 const {data:c,error}=await db.from('integration_connections').select('*').eq('workspace_id',workspaceId).eq('provider',provider).single();
 if(error||!c?.encrypted_credentials||c.status==='disconnected')throw new HttpError(409,'Verbind eerst dit kanaal.');
 if(c.status==='reconnect_required')throw new HttpError(409,'Verbind dit kanaal opnieuw.');
 let creds=decrypt<MetaCredentials>(c.encrypted_credentials,workspaceId+':'+provider);
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
  const {creds}=await metaConnection(workspaceId,provider);
  const url=provider==='instagram'?igGraph('/'+id+'?fields=name,username'):graph('/'+id+'?fields=first_name,last_name,name');
  const d=await metaJson(url,{headers:{Authorization:'Bearer '+creds.access_token}},provider);
  return {name:typeof d.name==='string'?d.name.slice(0,200):[d.first_name,d.last_name].filter(Boolean).join(' ').slice(0,200)||undefined,username:typeof d.username==='string'?d.username.slice(0,100):undefined};
 }catch{return {};}
}
