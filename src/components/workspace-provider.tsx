"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {emptyWorkspace} from '@/lib/storage';
import {syncContacts} from '@/lib/contact-data';
import {Toast} from '@/components/toast';
import {authRequest} from '@/lib/auth-client';
import type {Workspace} from '@/lib/types';
const Context=createContext<{data:Workspace;ready:boolean;save:(data:Workspace,message?:string)=>Promise<boolean>;signedOut:boolean;logout:()=>void;resume:()=>void;deleteAccount:()=>boolean}>({data:emptyWorkspace,ready:false,save:async()=>false,signedOut:false,logout:()=>{},resume:()=>{},deleteAccount:()=>false});
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<Workspace>(()=>({...structuredClone(emptyWorkspace),contacts:[],library:[],review:{...emptyWorkspace.review,reviews:[]}}));
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState('');
 const version=useRef(0),busy=useRef(false),role=useRef('MEMBER');const close=useCallback(()=>setToast(''),[]);
 syncContacts(data.contacts);
 useEffect(()=>{let active=true;fetch('/api/workspace',{cache:'no-store'}).then(async r=>{const result=await r.json();if(!r.ok)throw new Error(result.error||'Laden mislukt.');if(active){setData(result.data);version.current=result.version;role.current=result.role;setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function save(next:Workspace,message='Wijzigingen opgeslagen'){
 if(!ready||busy.current){setError('Wacht tot de vorige wijziging is opgeslagen.');return false;}
 if(role.current==='MEMBER'){setError('Je hebt geen toestemming om deze werkruimte te wijzigen.');return false;}
 busy.current=true;setError('');
 try { const response=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,version:version.current})}); const result=await response.json();if(!response.ok)throw new Error(result.error||'Opslaan mislukt.'); version.current=result.version;setData(next);setToast(message);return true; } catch(e) {setError(e instanceof Error?e.message:'Opslaan mislukt.');return false;} finally {busy.current=false;}
 }
 return <Context.Provider value={{data,ready,save,signedOut:false,logout:()=>{void authRequest('logout').catch(e=>setError(e.message));},resume:()=>window.location.assign('/login'),deleteAccount:()=>{setError('Gebruik de beveiligde verwijderprocedure. Er zijn geen gegevens verwijderd.');return false;}}}>{error&&<div className="storage-error" role="alert">{error}</div>}{ready?children:<p role="status">{error?'Werkruimte niet beschikbaar.':'Werkruimte laden…'}</p>}{toast&&<Toast message={toast} onClose={close}/>}</Context.Provider>;
}
export const useWorkspace=()=>useContext(Context);
