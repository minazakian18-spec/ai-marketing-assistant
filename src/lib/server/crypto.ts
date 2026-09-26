import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function key(){const k=Buffer.from(process.env.OAUTH_ENCRYPTION_KEY||'','base64');if(k.length!==32)throw new Error('ENCRYPTION_SETUP_REQUIRED');return k;}
export function encrypt(value:unknown,context:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(context));const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(v=>v.toString('base64url')).join('.');}
export function decrypt<T>(value:string,context:string):T{const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64url'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(context));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString());}
