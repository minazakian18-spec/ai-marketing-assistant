import {NextResponse} from 'next/server';
import {workspace,failure,HttpError,sameOrigin,limited} from '@/lib/server/access';
import {emptyWorkspace} from '@/lib/storage';
import {applyContactUnsubscribes,contactConsentGuard,syncNewsletterContacts} from '@/lib/server/newsletter';
import type {Contact} from '@/lib/types';
import {brandProfileSchema,brandAssetsValid} from '@/lib/server/brand-validation';
import {z} from 'zod';
import {copyValid} from '@/lib/studio';
import {campaignValid,campaignLinksValid} from '@/lib/campaigns';
import {goalsValid} from '@/lib/insights';
import {carouselValid} from '@/lib/carousel';
import {workspacePlan} from '@/lib/server/plan';
// Newsletter signups are merged into the stored contacts when the workspace is
// loaded (syncNewsletterContacts); saves keep unsubscribes and suppressions in
// step with the Contacts module.
export async function GET(){try{const {db,user,workspaceId,role}=await workspace();const {data,error}=await db.from('business_profiles').select('data,version').eq('workspace_id',workspaceId).single();if(error)throw new HttpError(503,'Werkruimte laden is niet gelukt.');const synced=await syncNewsletterContacts(workspaceId,data.data||{},data.version);const {data:personal,error:profileError}=await db.from('profiles').select('full_name,first_name,last_name,phone,photo').eq('id',user.id).single();if(profileError)throw new HttpError(503,'Profiel laden is niet gelukt.');const empty=structuredClone(emptyWorkspace);empty.contacts=[];empty.library=[];if(empty.review)empty.review.reviews=[];const value={...empty,...synced.data,profile:{...empty.profile,...synced.data.profile},account:{...empty.account,firstName:personal.first_name||personal.full_name||'',lastName:personal.last_name,phone:personal.phone,photo:personal.photo,email:user.email||''},integrations:empty.integrations};return NextResponse.json({data:value,version:synced.version,role,draftScope:workspaceId+":"+user.id},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function PUT(request:Request){try{sameOrigin(request);const {db,workspaceId,user}=await workspace(['OWNER','ADMIN']);await limited('save:'+user.id,60);const text=await request.text();if(text.length>5_000_000)throw new HttpError(413,'Deze werkruimte is te groot.');const {data,version}=z.object({version:z.number().int().nonnegative(),data:z.object({profile:z.object({name:z.string().max(160)}).passthrough(),posts:z.array(z.object({id:z.string(),status:z.enum(['draft','approved','scheduled','rejected','blocked','failed','published'])}).passthrough()).max(10000)}).passthrough()}).parse(JSON.parse(text));const {data:previous,error:previousError}=await db.from('business_profiles').select('data').eq('workspace_id',workspaceId).single();if(previousError)throw previousError;const oldPosts=previous.data?.posts||[];if(data.posts.some(p=>p.status==='published'&&!oldPosts.some((old:{id:string;status:string})=>old.id===p.id&&old.status==='published')))throw new HttpError(409,'Publiceren vereist een echte provideractie. Er is niets gepubliceerd.');
 // Instagram confirmations (media id, permalink) are written by the server only.
 const igOf=(p:unknown)=>JSON.stringify((p as {instagram?:unknown}).instagram??null);
 if(data.posts.some(p=>p.instagram!==undefined&&igOf(p)!==igOf(oldPosts.find((old:{id:string})=>old.id===p.id)||{})))throw new HttpError(409,'Een Instagram-publicatie kan alleen door Mavix zelf worden vastgelegd.');
 const dlOf=(c:unknown)=>JSON.stringify((c as {delivery?:unknown}).delivery??null);const oldMails=(previous.data?.email?.campaigns||[]) as {id:string}[];
 if(((data.email as {campaigns?:unknown[]})?.campaigns||[]).some(c=>(c as {delivery?:unknown}).delivery!==undefined&&dlOf(c)!==dlOf(oldMails.find(o=>o.id===(c as {id:string}).id)||{})))throw new HttpError(409,'Een verzending kan alleen door Mavix zelf worden vastgelegd.');
 // Brand Hub: structured fields and images (PNG/JPEG/WebP data URLs only, size-limited).
 const profile=brandProfileSchema.parse(data.profile);
 // Content Studio marketing copy: own records in the same workspace blob.
 if(data.copies!==undefined&&(!Array.isArray(data.copies)||data.copies.length>1000||!data.copies.every(copyValid)))throw new HttpError(400,'Ongeldige marketingteksten.');
 // Instagram carousels: slide data within limits.
 if(data.posts.some(p=>!carouselValid((p as {carousel?:unknown}).carousel)))throw new HttpError(400,'Ongeldige carrousel.');
 // New carousels need the carousel entitlement (Growth and Premium); existing ones stay editable.
 const hadCarousel=new Set(oldPosts.filter((o:{carousel?:unknown})=>o.carousel).map((o:{id:string})=>o.id));
 if(data.posts.some(p=>(p as {carousel?:unknown}).carousel&&!hadCarousel.has(p.id))){const wpc=await workspacePlan(workspaceId);if(!wpc.plan.entitlements.includes('carousels'))throw new HttpError(402,`Carrousels zitten niet in je ${wpc.plan.name}-abonnement. Maak complete Instagram-carrousels met Mavix Growth.`);}
 // Insights goals: at most one per kind, within sane ranges.
 if(!goalsValid(data.goals))throw new HttpError(400,'Ongeldige doelen.');
 // Content Studio campaigns: own small records; items only link to them (campaignId).
 if(data.campaigns!==undefined&&(!Array.isArray(data.campaigns)||data.campaigns.length>500||!data.campaigns.every(campaignValid)))throw new HttpError(400,'Ongeldige campagnes.');
 if(!campaignLinksValid(data as unknown as Parameters<typeof campaignLinksValid>[0]))throw new HttpError(400,'Een concept verwijst naar een campagne die niet bestaat.');
 if(!brandAssetsValid(profile,previous.data?.profile||{}))throw new HttpError(400,'Ongeldige afbeelding. Gebruik een PNG-, JPG- of WebP-bestand binnen de uploadlimiet.');
 const before=(Array.isArray(previous.data?.contacts)?previous.data.contacts:[]) as Contact[],after=(Array.isArray(data.contacts)?data.contacts:[]) as Contact[];
 // Contacts per plan. Existing contacts are never removed; only growth beyond the limit is refused.
 const wp=await workspacePlan(workspaceId);if(after.length>before.length&&after.length>wp.plan.contacts)throw new HttpError(402,`Je ${wp.plan.name}-abonnement heeft ruimte voor ${wp.plan.contacts.toLocaleString('nl-NL')} contacten. Verwijder contacten of kies een groter abonnement.`);
 // Refuse re-subscribing suppressed addresses; record new unsubscribes first.
 await contactConsentGuard(workspaceId,before,after);await applyContactUnsubscribes(workspaceId,before,after);
 delete data.account;delete data.integrations;delete data.notifications;const {data:updated,error}=await db.from('business_profiles').update({data,version:version+1,updated_at:new Date().toISOString()}).eq('workspace_id',workspaceId).eq('version',version).select('version').maybeSingle();if(error)throw new HttpError(503,'Opslaan is niet gelukt.');if(!updated)throw new HttpError(409,'De werkruimte is elders gewijzigd. Herlaad voor je opnieuw opslaat.');return NextResponse.json(updated);}catch(e){if(e instanceof z.ZodError)return failure(new HttpError(400,'Ongeldige werkruimtegegevens.'));return failure(e);}}
