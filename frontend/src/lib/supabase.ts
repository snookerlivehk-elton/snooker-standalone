import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (!client) {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    return client;
  } catch {
    return null;
  }
}

export function getRoomChannel(roomId: string) {
  const c = getSupabaseClient();
  if (!c) return null;
  const channelName = `room_${roomId}`;
  return c.channel(channelName, { config: { broadcast: { self: false } } });
}
