// api/drivers/location.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { latitude, longitude, status } = req.body;
    let driver_id = req.body.driver_id;

    // The driver app doesn't send driver_id in the body, it sends the JWT token.
    // We must extract driver_id from the token to fix the "Missing driver_id" 400 error.
    if (!driver_id) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          driver_id = user.id;
        }
      }
    }

    if (!driver_id) {
      return res.status(400).json({ error: 'Missing driver_id' });
    }

    // Check if driver exists
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', driver_id)
      .single();

    // If driver doesn't exist, create a record immediately
    if (checkError && checkError.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('drivers')
        .insert({
          id: driver_id,
          vehicle_model: 'Not set',
          vehicle_plate: 'Not set',
          is_online: status === 'online' || status === 'busy',
          status: status || 'offline',
          current_lat: latitude || null,
          current_lng: longitude || null
        });

      if (insertError) {
        console.error('Driver creation failed:', insertError);
        return res.status(500).json({ error: 'Failed to create driver record' });
      }

      return res.status(200).json({ success: true, message: 'Driver record created' });
    }

    // Update existing driver
    const updateData = {};
    if (latitude !== undefined) updateData.current_lat = latitude;
    if (longitude !== undefined) updateData.current_lng = longitude;
    if (status) {
      updateData.status = status;
      updateData.is_online = (status === 'online' || status === 'busy');
    }

    const { data, error } = await supabase
      .from('drivers')
      .update(updateData)
      .eq('id', driver_id)
      .select();

    if (error) {
      console.error('Driver update failed:', error);
      return res.status(500).json({ error: 'Failed to update driver location' });
    }

    return res.status(200).json({
      success: true,
      driver: data?.[0] || null
    });

  } catch (error) {
    console.error('Crash in location API:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
