// api/users/rides.js — Passenger/Driver ride history
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

async function getUserId(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token || token === 'undefined' || token === 'null') return null;
  const { data: { user }, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserId(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', userId).single();

    let query = supabaseAdmin
      .from('rides')
      .select('id, status, price, pickup_address, dropoff_address, created_at, driver_id, passenger_id')
      .order('created_at', { ascending: false })
      .limit(50);

    if (profile?.role === 'driver') {
      query = query.eq('driver_id', userId);
    } else {
      query = query.eq('passenger_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
