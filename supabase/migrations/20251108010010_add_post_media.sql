-- Post media table to store uploaded media files per parsed post
create table if not exists public.post_media (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.parsed_posts(id) on delete cascade,
  media_type text not null, -- image | gif | video | other
  mime_type text,
  url text not null,
  storage_path text,
  width integer,
  height integer,
  duration numeric,
  order_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_post_media_post_id on public.post_media(post_id);
create index if not exists idx_post_media_post_id_order on public.post_media(post_id, order_index);


