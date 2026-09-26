import 'server-only';
import {HttpError,limited} from './access';
// Supplemental single-process protection. Supabase Auth still enforces provider
// limits. Production requires the shared database limiter before serving auth.
const buckets=new Map<string,{count:number;expires:number}>();
export async function authLimit(key:string,limit:number){
 if(process.env.SUPABASE_SERVICE_ROLE_KEY)return limited(key,limit);
 if(process.env.NODE_ENV==='production')throw new HttpError(503,'Authenticatie vereist nog serverconfiguratie.');
 const now=Date.now();for(const [k,v] of buckets)if(v.expires<=now)buckets.delete(k);
 const entry=buckets.get(key)||{count:0,expires:now+60000};
 if(!buckets.has(key)&&buckets.size>=5000)throw new HttpError(429,'Probeer later opnieuw.');
 entry.count++;buckets.set(key,entry);if(entry.count>limit)throw new HttpError(429,'Te veel aanvragen. Probeer later opnieuw.');
}
