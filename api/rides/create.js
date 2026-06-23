// api/rides/create.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default async function handler(req, res) {
  console.log('📥 CREATE RIDE API CALLED');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      pickup_lat, pickup_lng, pickup_address,
      dropoff_lat, dropoff_lng, dropoff_address,
      price, distance, duration, user_id
    } = req.body;

    console.log('📝 Request data:', { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, price });

    if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let userId = user_id;

    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const pinCode = generatePin();

    // ✅ COLUMN NAMES MATCH YOUR DATABASE EXACTLY
    const rideData = {
      passenger_id: userId,
      pickup_lat: pickup_lat,
      pickup_lng: pickup_lng,
      pickup_address: pickup_address || 'Selected location',
      dropoff_lat: dropoff_lat,
      dropoff_lng: dropoff_lng,
      dropoff_address: dropoff_address || 'Selected destination',
      price: price,
      distance: distance || 0,
      duration: duration || 0,
      status: 'requested',
      pin_code: pinCode,
      pin_verified: false
    };

    console.log('💾 Inserting:', rideData);

    const { data, error } = await supabase
      .from('rides')
      .insert(rideData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to create ride',
        details: error.message,
        code: error.code
      });
    }

    console.log('✅ Ride created:', data.id);
    return res.status(200).json({
      success: true,
      ride: data,
      pin_code: pinCode
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
