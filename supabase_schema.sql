-- Run this in your Supabase SQL editor (full reset — drop and recreate)

drop table if exists player_sessions cascade;
drop table if exists sessions cascade;
drop table if exists profiles cascade;

-- Profiles (host accounts only)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);


-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  date timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "Anyone authenticated can read sessions"
  on sessions for select using (auth.uid() is not null);

create policy "Authenticated users can create sessions"
  on sessions for insert with check (auth.uid() is not null);

create policy "Creator can update session"
  on sessions for update using (auth.uid() = created_by);


-- Players in a session (name-based, no account needed)
create table player_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  name text not null,
  buy_ins numeric[] not null default '{}',
  cash_out numeric,
  created_at timestamptz default now()
);

alter table player_sessions enable row level security;

create policy "Anyone authenticated can read player_sessions"
  on player_sessions for select using (auth.uid() is not null);

create policy "Authenticated users can insert player_sessions"
  on player_sessions for insert with check (auth.uid() is not null);

create policy "Authenticated users can update player_sessions"
  on player_sessions for update using (auth.uid() is not null);

create policy "Authenticated users can delete player_sessions"
  on player_sessions for delete using (auth.uid() is not null);
