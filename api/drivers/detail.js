// api/drivers/detail.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing driver ID' });
  }

  try {
    console.log('🔍 Fetching driver details for:', id);

    // 1. Get the driver's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      // Return basic info if profile not found
      return res.status(200).json({
        id: id,
        name: 'Driver',
        vehicle_model: 'Not set',
        vehicle_plate: 'Not set',
        is_online: false,
        status: 'offline',
        stats: {
          totalEarnings: 0,
          totalRides: 0,
          avgRating: 5.0
        }
      });
    }

    // 2. Get driver-specific info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single();

    if (driverError) {
      console.warn('⚠️ Driver record not found, using default values');
    }

    // 3. Get earnings stats
    const { data: rides, error: ridesError } = await supabase
      .from('rides')
      .select('price, rating')
      .eq('driver_id', id)
      .eq('status', 'completed');

    let totalEarnings = 0;
    let totalRides = 0;
    let avgRating = 5.0;

    if (!ridesError && rides) {
      totalRides = rides.length;
      totalEarnings = rides.reduce((sum, r) => sum + parseFloat(r.price || 0), 0);
      
      const ratedRides = rides.filter(r => r.rating);
      if (ratedRides.length > 0) {
        avgRating = ratedRides.reduce((sum, r) => sum + r.rating, 0) / ratedRides.length;
      }
    }

    // 4. Return combined data
    return res.status(200).json({
      id: profile.id,
      name: profile.name || profile.full_name || 'Driver',
      email: profile.email || '',
      phone: profile.phone || null,
      role: profile.role || 'driver',
      vehicle_model: driver?.vehicle_model || 'Not set',
      vehicle_plate: driver?.vehicle_plate || 'Not set',
      is_online: driver?.is_online || false,
      status: driver?.status || 'offline',
      current_lat: driver?.current_lat || null,
      current_lng: driver?.current_lng || null,
      stats: {
        totalEarnings: totalEarnings,
        totalRides: totalRides,
        avgRating: parseFloat(avgRating.toFixed(1))
      }
    });

  } catch (error) {
    console.error('❌ Error in driver detail:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
