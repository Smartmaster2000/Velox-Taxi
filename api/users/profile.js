// api/users/profile.js
// Handles GET /api/users/profile  → fetch user profile
//          PUT /api/users/profile  → update user profile
//          GET /api/users/rides    → fetch user ride history
// (The /api/users/rides endpoint is now handled by this file via ?type=rides)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Service role client — bypasses RLS for reads/writes
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

// Validate JWT and return user ID
async function getUserId(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token || token === 'undefined' || token === 'null') return null;
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserId(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // ─── GET /api/users/profile ───────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Attach driver vehicle info if applicable
      if (profile?.role === 'driver') {
        const { data: driverData } = await supabaseAdmin
          .from('drivers')
          .select('vehicle_model, vehicle_plate, status')
          .eq('id', userId)
          .single();
        if (driverData) Object.assign(profile, driverData);
      }

      return res.status(200).json(profile);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─── PUT /api/users/profile ───────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      const { name, phone } = req.body;
      const updates = {};
      if (name)  updates.name  = name;
      if (phone) updates.phone = phone;

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
