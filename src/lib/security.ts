export type Role='OWNER'|'ADMIN'|'MEMBER';
export function hasRole(role:Role,allowed:readonly Role[]) {return allowed.includes(role);}
export function safeNext(value:string|null) {return value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'/dashboard';}
export const notificationEvents=['new_review','negative_review','review_reply_ready','content_ready','content_published','content_failed','email_campaign_completed','integration_disconnected','payment_failed','subscription_changed','security_alert'] as const;
export const notificationChannels=['IN_APP','EMAIL','SMS'] as const;

export function oauthStateMatches(state:string|null,cookie:string|undefined){return !!state&&state.length>=40&&state.length<=100&&state===cookie;}
export function requiresAuthentication(path:string){return ['/dashboard','/account','/ai-content','/bedrijfsprofiel','/brand-hub','/contacten','/contentkalender','/email-ai','/instagram-ai','/inzichten','/library','/review-ai'].some(root=>path===root||path.startsWith(root+'/'));}
export function selectedMembership<T extends {workspace_id:string;role:Role}>(members:T[],selected?:string){return selected?members.find(m=>m.workspace_id===selected):members[0];}
export function wantsNotification(preferences:{event_type:string;channel:string;enabled:boolean}[],event:string,channel:string){return preferences.some(p=>p.event_type===event&&p.channel===channel&&p.enabled);}
