-- Исправление структуры таблицы user_profiles
-- Переименовываем user_id в id и делаем его первичным ключом (если нужно)

-- Сначала удаляем старый первичный ключ
alter table if exists public.user_profiles 
  drop constraint if exists user_profiles_pkey;

-- Удаляем старый индекс на user_id (если был отдельный)
drop index if exists public.idx_user_profiles_user_id;

-- Проверяем, какая колонка существует, и переименовываем только если нужно
do $$
begin
  -- Если существует user_id, но не существует id, переименовываем
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_profiles' 
    and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_profiles' 
    and column_name = 'id'
  ) then
    alter table public.user_profiles rename column user_id to id;
  end if;
end $$;

-- Делаем id первичным ключом (если еще не установлен)
alter table if exists public.user_profiles 
  add constraint user_profiles_pkey primary key (id);

-- Обновляем RLS политики для использования id вместо user_id
drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.user_profiles where id = auth.uid()));

drop policy if exists "Admins can view all profiles" on public.user_profiles;
create policy "Admins can view all profiles"
  on public.user_profiles
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins can update all profiles" on public.user_profiles;
create policy "Admins can update all profiles"
  on public.user_profiles
  for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Обновляем функцию handle_new_user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

