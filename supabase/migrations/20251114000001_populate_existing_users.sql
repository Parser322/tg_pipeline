-- Миграция данных: создание профилей для существующих пользователей
-- Эта миграция создает записи в user_profiles для всех пользователей,
-- которые уже существуют в auth.users, но еще не имеют профиля

insert into public.user_profiles (id, role)
select 
  id,
  'user' as role
from auth.users
where id not in (
  select id from public.user_profiles
)
on conflict (id) do nothing;

