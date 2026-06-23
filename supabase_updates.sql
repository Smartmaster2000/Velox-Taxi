-- 1. Alter Drivers Table
ALTER TABLE public.drivers 
  RENAME COLUMN latitude TO current_lat;
ALTER TABLE public.drivers 
  RENAME COLUMN longitude TO current_lng;

ALTER TABLE public.drivers 
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text;

-- 2. Ensure RLS on Rides is correct
-- Drop existing overlapping policies to be clean
DROP POLICY IF EXISTS "Passengers can view their own rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view rides assigned to them" ON public.rides;
DROP POLICY IF EXISTS "Passengers can insert rides" ON public.rides;
DROP POLICY IF EXISTS "Passengers/Drivers/Available drivers can update rides" ON public.rides;

-- Recreate exactly according to requirements
CREATE POLICY "Users can view their own rides" ON public.rides
    FOR SELECT USING (auth.uid() = passenger_id OR auth.uid() = driver_id);

CREATE POLICY "Passengers can insert rides" ON public.rides
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Users can update rides" ON public.rides
    FOR UPDATE USING (
        auth.uid() = passenger_id OR 
        auth.uid() = driver_id OR 
        (driver_id IS NULL AND status = 'requested')
    );

-- 3. Haversine function for nearby drivers
CREATE OR REPLACE FUNCTION get_nearby_drivers(
    search_lat numeric, 
    search_lng numeric, 
    radius_km numeric
) 
RETURNS TABLE (
    driver_id uuid,
    name text,
    vehicle_model text,
    vehicle_plate text,
    current_lat numeric,
    current_lng numeric,
    distance numeric
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        d.id AS driver_id,
        p.name,
        d.vehicle_model,
        d.vehicle_plate,
        d.current_lat,
        d.current_lng,
        ( 6371 * acos( cos( radians(search_lat) ) * cos( radians( d.current_lat ) ) 
        * cos( radians( d.current_lng ) - radians(search_lng) ) + sin( radians(search_lat) ) 
        * sin( radians( d.current_lat ) ) ) ) AS distance
    FROM public.drivers d
    JOIN public.profiles p ON p.id = d.id
    WHERE d.status = 'online' AND d.is_online = true
    HAVING ( 6371 * acos( cos( radians(search_lat) ) * cos( radians( d.current_lat ) ) 
        * cos( radians( d.current_lng ) - radians(search_lng) ) + sin( radians(search_lat) ) 
        * sin( radians( d.current_lat ) ) ) ) <= radius_km
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. View for Ride Details (Passenger + Driver info)
CREATE OR REPLACE VIEW public.ride_details AS
SELECT 
    r.*,
    p.name AS passenger_name,
    p.avatar_url AS passenger_avatar,
    d.name AS driver_name,
    d.avatar_url AS driver_avatar,
    drv.vehicle_model,
    drv.vehicle_plate
FROM public.rides r
JOIN public.profiles p ON p.id = r.passenger_id
LEFT JOIN public.profiles d ON d.id = r.driver_id
LEFT JOIN public.drivers drv ON drv.id = r.driver_id;

-- 5. Additional Indexes
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON public.rides (passenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);

-- 6. Views for Ride Details with Users
CREATE OR REPLACE VIEW public.ride_details_with_users AS
SELECT 
    r.id, r.passenger_id, r.driver_id, r.pickup_address, r.dropoff_address, r.price, r.distance, r.duration, r.status, r.created_at, r.updated_at,
    p.name AS passenger_name, p.phone AS passenger_phone, p.avatar_url AS passenger_avatar,
    d.name AS driver_name, d.phone AS driver_phone, d.avatar_url AS driver_avatar,
    drv.vehicle_model, drv.vehicle_plate
FROM public.rides r
JOIN public.profiles p ON p.id = r.passenger_id
LEFT JOIN public.profiles d ON d.id = r.driver_id
LEFT JOIN public.drivers drv ON drv.id = r.driver_id;

-- 7. View for Driver Earnings
CREATE OR REPLACE VIEW public.driver_earnings AS
SELECT 
    r.driver_id,
    COUNT(r.id) as total_rides,
    COALESCE(SUM(r.price), 0) as total_earnings,
    COALESCE(AVG(r.rating), 0) as average_rating
FROM public.rides r
WHERE r.status = 'completed' AND r.driver_id IS NOT NULL
GROUP BY r.driver_id;


-- ==============================================================================
-- REALTIME AND RLS UPDATES (CRITICAL FOR FLOW)
-- ==============================================================================

-- 1. Enable Realtime Replication for the tables so socket events are broadcasted
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- 2. Allow Drivers to see rides that are currently looking for a driver ('requested')
CREATE POLICY "Drivers can view requested rides" 
ON public.rides 
FOR SELECT 
USING (status = 'requested');

-- 3. Allow Admins to see ALL rides (for the Admin Dashboard)
CREATE POLICY "Admins can view all rides" 
ON public.rides 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (user_type = 'admin' OR role = 'admin')
  )
);

-- 4. Allow Admins to see ALL drivers (for the Admin Dashboard map markers)
CREATE POLICY "Admins can view all drivers" 
ON public.drivers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (user_type = 'admin' OR role = 'admin')
  )
);

-- 5. Fix View Security so it bypasses RLS and allows drivers to get passenger info
ALTER VIEW public.ride_details_with_users SET (security_invoker = false);
