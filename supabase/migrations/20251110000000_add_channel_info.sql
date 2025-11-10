-- Add channel title and username fields to parsed_posts
alter table public.parsed_posts
add column if not exists channel_title text,
add column if not exists channel_username text;

-- Update existing records to set channel_username from source_channel
update public.parsed_posts
set channel_username = source_channel
where channel_username is null;

