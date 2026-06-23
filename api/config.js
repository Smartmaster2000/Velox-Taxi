export default function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    supabaseUrl:      process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:  process.env.SUPABASE_ANON_KEY  || process.env.VITE_SUPABASE_ANON_KEY,
    mapboxToken:      process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_TOKEN
  });
}
