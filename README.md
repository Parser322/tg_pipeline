### 1. Переменные окружения

```bash
cd backend
touch .env           # создайте файл, если его еще нет
nano .env            # заполните значения
```

Минимальный набор значений:

- `TELEGRAM_API_ID` и `TELEGRAM_API_HASH` — ключи Telegram.
- `OPENAI_API_KEY` — ключ OpenAI для перевода.
- `SUPABASE_URL` — URL проекта (https://<project>.supabase.co).
- `SUPABASE_SERVICE_ROLE_KEY` — service role key из Supabase (используется только на бэкенде).

В `config.yaml` задайте каналы и настройки логотипа.

### 2. Настройка Supabase

Варианты:

- Вариант A — автоматически через Supabase CLI (рекомендовано)
- Вариант B — вручную через SQL Editor
- Вариант C — через psql по connection string

#### Вариант A. Автоматически (Supabase CLI)

1. Установите CLI и войдите:

```bash
brew install supabase/tap/supabase     # macOS
supabase login
```

2. Свяжите локальный репозиторий с проектом:

```bash
supabase link --project-ref <PROJECT_REF>   # PROJECT_REF из настроек проекта
```

3. Примените миграции из репозитория:

```bash
supabase db push
```

CLI применит файл миграции `supabase/migrations/20251108000000_init.sql` и создаст нужные таблицы.

#### Вариант B. Вручную (SQL Editor)

1. В Supabase SQL Editor активируйте расширение для UUID (если требуется):

```sql
create extension if not exists "uuid-ossp";
```

2. Создайте таблицы и представление состояния:

```sql
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

create table if not exists public.saved_channel (
  id uuid primary key default uuid_generate_v4(),
  username text not null,
  saved_at timestamptz not null default timezone('utc', now())
);
```

Service role key автоматически обходит RLS, поэтому отдельные политики не требуются.

#### Вариант C. Через psql

1. Возьмите `Connection string` из Settings → Database.

2. Выполните:

```bash
psql "<POSTGRES_CONNECTION_STRING>" -f supabase/migrations/20251108000000_init.sql
```

### 3. Запуск

**Быстрый запуск:**

```bash
./run-backend    # Терминал 1
./run-frontend   # Терминал 2
```

**Ручной запуск:**

```bash
# Backend
cd backend
source venv/bin/activate  # или ./venv/bin/activate
uvicorn app.web:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```

Интерфейс доступен по адресу **http://localhost:3000**.
