import express from 'express';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export function createAdminAuth(adminToken: string): express.RequestHandler {
  return (req, res, next) => {
    if (!adminToken) {
      return res.status(503).json({ error: 'admin_token_not_configured' });
    }
    const token = (req.headers['x-admin-token'] as string) || (req.query.token as string) || '';
    if (token !== adminToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}

export function createRequireSupabaseAdmin(options: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}) {
  const { supabaseUrl, supabaseServiceRoleKey } = options;
  return function requireSupabaseAdmin() {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未能啟用後台上載功能');
    }
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { transport: ws as any },
    });
  };
}
