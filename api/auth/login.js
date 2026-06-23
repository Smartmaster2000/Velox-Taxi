// api/auth/login.js
import { createClient } from '@supabase/supabase-js';

// ✅ Use SERVICE ROLE KEY to bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

// Also create a regular client for user operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
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

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    // 1. Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    console.log('✅ User signed in:', data.user.id);

    // 2. ✅ FETCH THE ROLE FROM PROFILES USING ADMIN KEY (bypasses RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('name, role')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      // If profile doesn't exist, try to create one
      if (profileError.code === 'PGRST116') {
        console.log('🆕 Profile not found, creating one...');
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            name: data.user.user_metadata?.full_name || email,
            role: data.user.user_metadata?.role || 'passenger'
          });
        
        if (!insertError) {
          // Fetch the newly created profile
          const { data: newProfile } = await supabaseAdmin
            .from('profiles')
            .select('name, role')
            .eq('id', data.user.id)
            .single();
          
          return res.status(200).json({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              full_name: newProfile?.name || data.user.user_metadata?.full_name || 'User',
              role: newProfile?.role || data.user.user_metadata?.role || 'passenger'
            },
            session: data.session
          });
        }
      }
      
      // If profile fetch fails and we can't create one, fallback to user_metadata
      return res.status(200).json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'User',
          role: data.user.user_metadata?.role || 'passenger'
        },
        session: data.session
      });
    }

    console.log('✅ Profile fetched:', profile);
    console.log('✅ Role found:', profile.role);

    // ✅ Return the role from the database
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.name || data.user.user_metadata?.full_name || 'User',
        role: profile?.role || data.user.user_metadata?.role || 'passenger'
      },
      session: data.session
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(401).json({
      error: 'Invalid credentials',
      message: error.message
    });
  }
}
