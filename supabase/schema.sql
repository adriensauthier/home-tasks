-- HomeTasks database schema for Supabase
-- Run this file in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text,
  password_set_at timestamptz,
  person_id uuid not null unique references public.people(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.people (name)
values
  ('Stephane'),
  ('Claudine'),
  ('Adrien'),
  ('Lea')
on conflict (name) do nothing;

insert into public.app_users (username, person_id)
select 'stephane', id from public.people where name = 'Stephane'
on conflict (username) do nothing;

insert into public.app_users (username, person_id)
select 'claudine', id from public.people where name = 'Claudine'
on conflict (username) do nothing;

insert into public.app_users (username, person_id)
select 'adrien', id from public.people where name = 'Adrien'
on conflict (username) do nothing;

insert into public.app_users (username, person_id)
select 'lea', id from public.people where name = 'Lea'
on conflict (username) do nothing;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references public.people(id) on delete set null,
  frequency text not null default 'one_time' check (frequency in ('one_time', 'daily', 'weekly', 'monthly')),
  due_date date,
  done boolean not null default false,
  last_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_due_date_idx on public.tasks(due_date);

-- Keep direct public access closed. The Next.js API uses the server-side service role key.
alter table public.people enable row level security;
alter table public.app_users enable row level security;
alter table public.tasks enable row level security;
