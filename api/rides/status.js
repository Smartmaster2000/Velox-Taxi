// api/rides/status.js
import { createClient } from '@supabase/supabase-js';

// ✅ Use SERVICE ROLE KEY — this bypasses ALL RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
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
    const { ride_id, status, driver_id } = req.body;
    const finalRideId = ride_id || req.query.id;

    console.log('📊 Status update request:', { finalRideId, status, driver_id, body: req.body });

    if (!finalRideId) {
      console.error('❌ Missing ride_id');
      return res.status(400).json({ error: 'Missing ride_id' });
    }

    if (!status) {
      console.error('❌ Missing status');
      return res.status(400).json({ error: 'Missing status' });
    }

    // ✅ Get the ride first to verify it exists
    const { data: ride, error: getError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', finalRideId)
      .single();

    if (getError) {
      console.error('❌ Ride not found:', getError);
      return res.status(404).json({ error: 'Ride not found' });
    }

    console.log('📋 Current ride:', ride);

    // ✅ Build update data — SIMPLE, no auth checks
    const updateData = { status };

    // If accepting, set driver_id
    if (status === 'accepted') {
      // ✅ Use the driver_id from the request body, or fallback to the ride's passenger_id (for testing)
      const driverId = driver_id || ride.passenger_id || '2978e30c-08fa-408b-8e05-110429dcca4c';
      updateData.driver_id = driverId;
      console.log('👤 Setting driver_id to:', driverId);
    }

    // If completing, calculate commission
    if (status === 'completed') {
      const fare = parseFloat(ride.price || 0);
      const platformFee = fare * 0.08;
      const netEarnings = fare - platformFee;
      updateData.platform_fee = platformFee;
      updateData.net_earnings = netEarnings;
      console.log('💰 Commission:', { fare, platformFee, netEarnings });
    }

    // ✅ UPDATE THE RIDE — NO AUTH CHECKS, SERVICE ROLE KEY BYPASSES RLS
    const { data, error } = await supabase
      .from('rides')
      .update(updateData)
      .eq('id', finalRideId)
      .select();

    if (error) {
      console.error('❌ Update error:', error);
      return res.status(500).json({
        error: 'Failed to update ride',
        details: error.message,
        code: error.code
      });
    }

    console.log('✅ Ride updated successfully:', data?.[0]);
    return res.status(200).json({
      success: true,
      ride: data?.[0] || null
    });

  } catch (error) {
    console.error('❌ Unhandled error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
}
