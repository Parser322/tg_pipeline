-- User Telegram Credentials table
-- Хранит API credentials каждого пользователя для использования их собственных лимитов Telegram API

create table if not exists public.user_telegram_credentials (
  id uuid primary key default uuid_generate_v4(),
  user_identifier text not null unique, -- Идентификатор пользователя (email, user_id, etc)
  telegram_api_id integer not null,
  telegram_api_hash text not null,
  telegram_string_session text not null, -- Зашифрованная session string
  phone_number text, -- Опционально: номер телефона для справки
  is_active boolean default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Индексы для быстрого поиска
create index if not exists idx_user_telegram_creds_identifier 
  on public.user_telegram_credentials(user_identifier);
  
create index if not exists idx_user_telegram_creds_active 
  on public.user_telegram_credentials(is_active);

-- Функция для автоматического обновления updated_at
create or replace function update_user_telegram_credentials_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Триггер для обновления updated_at
drop trigger if exists update_user_telegram_credentials_updated_at_trigger 
  on public.user_telegram_credentials;
  
create trigger update_user_telegram_credentials_updated_at_trigger
  before update on public.user_telegram_credentials
  for each row
  execute function update_user_telegram_credentials_updated_at();

-- Комментарии для документации
comment on table public.user_telegram_credentials is 
  'Хранит Telegram API credentials пользователей для использования их собственных лимитов API';
comment on column public.user_telegram_credentials.user_identifier is 
  'Уникальный идентификатор пользователя (email, UUID, etc)';
comment on column public.user_telegram_credentials.telegram_string_session is 
  'Зашифрованная Telegram session string (используется Fernet шифрование)';

