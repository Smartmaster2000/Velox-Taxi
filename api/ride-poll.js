// api/ride-poll.js
// Simple, dedicated endpoint for passenger ride status polling
// Lives at /api/ride-poll — avoids all vercel.json /api/rides/:id routing conflicts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing ride id' });

  try {
    const { data: ride, error } = await supabase
      .from('rides')
      .select('id, status, driver_id, distance, price')
      .eq('id', id)
      .single();

    if (error) {
      console.error('ride-poll error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(ride || null);
  } catch (e) {
    console.error('ride-poll crash:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
