-- Удаление колонки user_id из таблицы user_profiles
-- Колонка id уже является первичным ключом и ссылается на auth.users(id)

-- Сначала проверяем и переносим данные из user_id в id, если нужно
do $$
begin
  -- Если существует колонка user_id и есть записи, где id NULL или отличается от user_id
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'user_profiles' 
    and column_name = 'user_id'
  ) then
    -- Обновляем id из user_id, если id пустой или отличается
    update public.user_profiles
    set id = user_id
    where id is null or id != user_id;
  end if;
end $$;

-- Удаляем колонку user_id, если она существует
alter table if exists public.user_profiles 
  drop column if exists user_id;

