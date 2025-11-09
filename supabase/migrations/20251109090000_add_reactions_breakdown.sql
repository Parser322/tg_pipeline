-- Add reactions breakdown storage
alter table if exists public.parsed_posts
add column if not exists original_reactions jsonb;


