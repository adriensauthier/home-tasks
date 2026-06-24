-- HomeTasks database schema for Supabase
-- Run this file in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

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
alter table public.tasks enable row level security;
