import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// ✅ ONLY these roles are allowed to register
const ALLOWED_ROLES = ['passenger', 'driver'];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get data from request body
  const { email, password, full_name, user_type } = req.body;

  // Validate required fields
  if (!email || !password || !full_name || !user_type) {
    return res.status(400).json({
      error: 'Missing required fields: email, password, full_name, user_type'
    });
  }

  // ✅ BLOCK ADMIN REGISTRATION - Only passenger and driver allowed
  if (!ALLOWED_ROLES.includes(user_type)) {
    return res.status(400).json({
      error: 'Invalid role. Allowed roles: passenger, driver'
    });
  }

  try {
    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role: user_type
        }
      }
    });

    if (error) throw error;

    // Create profile in profiles table
    if (data.user) {
      try {
        const { error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: email,
            name: full_name,
            role: user_type
          });

        if (insertError) {
          console.error('Profile insert error:', insertError);
        }
      } catch (profileErr) {
        console.error('Profile error:', profileErr);
      }
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Registration successful!',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        full_name: full_name,
        user_type: user_type
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({
      error: error.message,
      message: 'Registration failed. Please try again.'
    });
  }
}
