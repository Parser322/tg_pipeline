-- Enable extension for UUID generation (если еще не включено)
create extension if not exists "pgcrypto";

-- User Profiles table
-- Хранит профили пользователей с ролями
-- Связана с auth.users через id (который является первичным ключом и ссылается на auth.users.id)

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Индексы для быстрого поиска
-- id уже индексирован как первичный ключ, поэтому отдельный индекс не нужен
create index if not exists idx_user_profiles_role 
  on public.user_profiles(role);

-- Функция для автоматического обновления updated_at
create or replace function update_user_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Триггер для обновления updated_at
drop trigger if exists update_user_profiles_updated_at_trigger 
  on public.user_profiles;
  
create trigger update_user_profiles_updated_at_trigger
  before update on public.user_profiles
  for each row
  execute function update_user_profiles_updated_at();

-- Функция для автоматического создания профиля при регистрации пользователя
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Триггер для автоматического создания профиля
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- RLS (Row Level Security) политики
alter table public.user_profiles enable row level security;

-- Пользователи могут читать свой собственный профиль
create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

-- Пользователи могут обновлять свой собственный профиль (но не роль)
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.user_profiles where id = auth.uid()));

-- Админы могут читать все профили
create policy "Admins can view all profiles"
  on public.user_profiles
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Админы могут обновлять все профили (включая роли)
create policy "Admins can update all profiles"
  on public.user_profiles
  for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Комментарии для документации
comment on table public.user_profiles is 
  'Профили пользователей с ролями (user, admin)';
comment on column public.user_profiles.id is 
  'ID пользователя из auth.users (первичный ключ)';
comment on column public.user_profiles.role is 
  'Роль пользователя: user (обычный пользователь) или admin (администратор)';

