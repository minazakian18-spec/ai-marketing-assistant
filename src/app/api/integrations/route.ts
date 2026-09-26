import {NextResponse} from 'next/server';
import {workspace,failure} from '@/lib/server/access';
import {adminClient} from '@/lib/server/supabase';
export async function GET(){try{const auth=await workspace();const {data,error}=await adminClient().from('integration_connections').select('provider,display_name,status,scopes,expires_at,last_synced_at,metadata').eq('workspace_id',auth.workspaceId);if(error)throw error;return NextResponse.json({connections:data},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
