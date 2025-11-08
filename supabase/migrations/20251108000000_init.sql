-- Enable extension for UUID v4
create extension if not exists "uuid-ossp";

-- State table
create table if not exists public.pipeline_state (
  id text primary key,
  processed integer not null default 0,
  total integer not null default 0,
  is_running boolean not null default false,
  finished boolean not null default false,
  channels jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.pipeline_state (id)
values ('progress_tracker')
on conflict (id) do nothing;

-- Posts table
create table if not exists public.parsed_posts (
  id uuid primary key default uuid_generate_v4(),
  source_channel text,
  original_message_id bigint,
  original_ids jsonb,
  original_date timestamptz,
  content text,
  translated_content text,
  target_lang text,
  has_media boolean default false,
  media_count integer default 0,
  is_merged boolean default false,
  is_top_post boolean default false,
  original_views integer,
  original_likes integer,
  original_comments integer,
  saved_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz
);

-- Saved channel table
create table if not exists public.saved_channel (
  id uuid primary key default uuid_generate_v4(),
  username text not null,
  saved_at timestamptz not null default timezone('utc', now())
);

