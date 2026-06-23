-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Profiles table (extends Supabase Auth)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    name text not null,
    role text not null check (role in ('passenger', 'driver', 'admin')),
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Drivers table (extends profiles for driver-specific state)
create table public.drivers (
    id uuid references public.profiles(id) on delete cascade primary key,
    status text not null default 'offline' check (status in ('online', 'offline', 'busy')),
    latitude numeric(9,6),
    longitude numeric(9,6),
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Rides table
create table public.rides (
    id uuid default gen_random_uuid() primary key,
    passenger_id uuid references public.profiles(id) not null,
    driver_id uuid references public.profiles(id),
    status text not null default 'requested' check (status in ('requested', 'accepted', 'pickup', 'enroute', 'completed', 'cancelled')),
    pickup_lat numeric(9,6) not null,
    pickup_lng numeric(9,6) not null,
    pickup_address text not null,
    dropoff_lat numeric(9,6) not null,
    dropoff_lng numeric(9,6) not null,
    dropoff_address text not null,
    price numeric(10,2) not null,
    distance numeric(10,2) not null, -- in km
    duration numeric(10,2) not null, -- in minutes
    cancellation_reason text,
    rating integer check (rating >= 1 and rating <= 5),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.rides enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone" on public.profiles
    for select using (true);

create policy "Users can update their own profile" on public.profiles
    for update using (auth.uid() = id);

-- Drivers Policies
create policy "Drivers are viewable by authenticated users" on public.drivers
    for select to authenticated using (true);

create policy "Drivers can update their own status/location" on public.drivers
    for update using (auth.uid() = id);

-- Rides Policies
create policy "Passengers can view their own rides" on public.rides
    for select using (auth.uid() = passenger_id);

create policy "Drivers can view rides assigned to them" on public.rides
    for select using (auth.uid() = driver_id);

create policy "Passengers can insert rides" on public.rides
    for insert with check (auth.uid() = passenger_id);

create policy "Passengers/Drivers/Available drivers can update rides" on public.rides
    for update using (auth.uid() = passenger_id or auth.uid() = driver_id or (driver_id is null and status = 'requested'));

create policy "Admins can do everything on rides" on public.rides
    for all using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- Automatically create a profile and driver entry on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
    user_role text;
    user_name text;
begin
    -- Extract metadata from auth.users signup
    user_role := coalesce(new.raw_user_meta_data->>'role', 'passenger');
    user_name := coalesce(new.raw_user_meta_data->>'name', 'User');

    insert into public.profiles (id, name, role)
    values (new.id, user_name, user_role);

    -- If driver, also insert into drivers table
    if user_role = 'driver' then
        insert into public.drivers (id, status)
        values (new.id, 'offline');
    end if;

    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
