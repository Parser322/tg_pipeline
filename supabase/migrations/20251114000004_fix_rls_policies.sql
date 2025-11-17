-- Исправление RLS политик для user_profiles
-- Проблема: политика для админов создает циклическую зависимость

-- Удаляем старые политики
drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Admins can view all profiles" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Admins can update all profiles" on public.user_profiles;

-- Создаем функцию для проверки, является ли пользователь админом (с security definer)
create or replace function public.is_user_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.user_profiles
    where id = user_id and role = 'admin'
  );
end;
$$;

-- Пользователи могут читать свой собственный профиль
create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

-- Админы могут читать все профили (используем функцию для проверки роли)
create policy "Admins can view all profiles"
  on public.user_profiles
  for select
  using (public.is_user_admin(auth.uid()));

-- Пользователи могут обновлять свой собственный профиль (но не роль)
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id 
    and role = (select role from public.user_profiles where id = auth.uid())
  );

-- Админы могут обновлять все профили (включая роли)
create policy "Admins can update all profiles"
  on public.user_profiles
  for update
  using (public.is_user_admin(auth.uid()));

