# PROJECT_RULES.md

## Overview

- Проект: интерфейс управления пайплайном парсинга Telegram‑каналов, управления постами и Telegram‑credentials.
- Фронтенд: Next.js 16 (App Router) + React 19 + TypeScript.
- Основные библиотеки: @tanstack/react-query, Tailwind CSS, Radix UI (через shadcn‑ui‑подобные компоненты), sonner для тостов.

## Tech Stack

- `next@16` с App Router (`app/` директория).
- `react@19`, `react-dom@19`.
- TypeScript (`tsconfig.json` с alias `@/*` на корень `frontend`).
- Стили: Tailwind CSS (`tailwind.config.js`, `app/globals.css`).
- Состояние/данные:
  - React Query (`@tanstack/react-query`) для клиентского data fetching и кэширования.
  - Собственные хуки (`hooks/`) поверх HTTP‑клиента.
- HTTP:
  - `services/apiClient.ts` — обёртка вокруг `fetch`.
  - `services/api.ts` — доменные методы API бекенда.
  - `services/translation.ts` — клиент для сервиса перевода.

## Architecture

### Директория `app/` (Next.js App Router)

- `app/layout.tsx` — корневой layout:
  - Подключает глобальные стили `app/globals.css`.
  - Оборачивает приложение в `Providers` (`app/providers.tsx`) с React Query и Toaster.
  - Встраивает `SidebarProvider` и `AppSidebar` как общий shell (левый сайдбар).
  - Рендерит `SiteHeader` и основное содержимое (`{children}`).
- `app/page.tsx` — главная страница (dashboard):
  - Рендерит `Dashboard` из `components/Dashboard.tsx` (client component).
- `app/posts/page.tsx` — страница списка постов:
  - Рендерит `PostsList` из `components/PostsList.tsx`.
- `app/settings/page.tsx` — страница настроек:
  - Client component, использует `TelegramCredentialsManager`.
- `app/loading.tsx`, `app/posts/loading.tsx`:
  - Общий/страничный спиннеры для состояния загрузки.
- `app/error.tsx`:
  - Client error boundary для всего приложения.
- `app/api/.../route.ts`:
  - Локальный Route Handler для `POST /api/posts/[postId]/media/[mediaId]/load-large`, проксирующий запрос в внешний API (бекенд).

Правило:  
- Новые страницы создаём через сегменты `app/<route>/page.tsx`, при необходимости добавляя `loading.tsx`/`error.tsx` локального уровня.  
- Layout’ы и shell‑компоненты (sidebar/header) подключаем в `app/layout.tsx` либо в сегментные `layout.tsx`, если появятся отдельные подсекции.

### Директории верхнего уровня

- `components/`
  - Общие UI‑компоненты и композиции:
    - Навигация (`AppSidebar.tsx`, `NavMain.tsx`, `NavUser.tsx`, `SiteHeader.tsx`).
    - Бизнес‑ориентированные компоненты: `Dashboard`, `PostsList`, `PostCard`, `TelegramCredentialsManager`, `ControlButtons`, `HeaderDeleteAllButton`, `OversizedMediaPlaceholder` и т.п.
  - Поддиректория `components/ui/` — переиспользуемые UI building blocks (shadcn‑подобные): `button`, `card`, `alert`, `input`, `sidebar`, `sheet`, `tooltip`, `progress`, `social-icons` и др.
- `hooks/`
  - Кастомные хуки над React Query и локальным state: `usePipeline`, `usePosts`, `useChannel`, `usePostLimit`, `usePostsSort`, `useProgressToast`, `useIsMobile`, `useLargeMediaLoad`.
- `services/`
  - `services/apiClient.ts` — слой HTTP‑клиента (FetchClient).
  - `services/api.ts` — доменные методы бекенда (pipeline, posts, channels, telegram credentials).
  - `services/translation.ts` — клиент сервиса перевода.
- `lib/`
  - Доменные‑агностичные утилиты:
    - `dateUtils.ts` — форматирование дат.
    - `errorUtils.ts` — нормализация ошибок и `ApiError`.
    - `queryKeys.ts` — ключи React Query.
    - `utils.ts` — `cn` (clsx + tailwind-merge).
- `constants/`
  - `index.ts` — конфиги API (`API_CONFIG`), сообщения (`MESSAGES`), UI‑константы (`UI_CONFIG`).
- `types/`
  - `api.ts` — все основные типы данных домена (Post, MediaItem, SortBy, PipelineStatus, TelegramCredentials, ответы API и т.д.).

## Naming Conventions

### Общие принципы

- Папки:
  - Базовые директории: `app`, `components`, `hooks`, `lib`, `services`, `constants`, `types`.
  - Внутри `components/ui` — `kebab-case` для файлов (`button.tsx`, `alert-dialog.tsx`, `social-icons.tsx`) в стиле shadcn‑ui.
  - Внутри остальных каталогов — либо `PascalCase.tsx` для компонент верхнего уровня (`Dashboard.tsx`), либо `camelCase.ts`/`kebab-case.ts` для утилит и хуков.
- Файлы React‑компонентов:
  - Вне `components/ui`: `PascalCase.tsx`, например:
    - `components/Dashboard.tsx`
    - `components/PostsList.tsx`
    - `components/TelegramCredentialsManager.tsx`
  - В `components/ui`: `kebab-case.tsx` (совпадает с импортами shadcn).
- Компоненты:
  - Имена в коде всегда `PascalCase` (например, `Dashboard`, `PostsList`, `PostCard`, `AppSidebar`).
  - При экспорте допускается `default` или именованный экспорт, но внутри проекта желательно избегать смешения для однотипных сущностей (см. рекомендации ниже).
- Хуки:
  - Имя функции: `useXxx` (camelCase, начинается с `use`).
  - Имя файла: `useXxx.ts` / `useXxx.tsx` (желательно без дефисов).
  - Примеры:
    - `hooks/usePipeline.ts`
    - `hooks/usePosts.ts`
    - `hooks/usePostsSort.ts`
    - `hooks/useProgressToast.tsx`
    - Новые хуки: `hooks/useFooBar.ts`.
- Утилиты:
  - Имя файла отражает действие: `formatPostDate.ts`, `getErrorMessage.ts` (сейчас часть утилит сгруппирована в `dateUtils.ts`, `errorUtils.ts` — это допустимо).
- Типы:
  - Содержатся в `types/api.ts` или рядом с фичей при необходимости.
  - Имена типов: `PascalCase` (`Post`, `MediaItem`, `PipelineStatus`, `TelegramCredentials`).

### Примеры «правильно/неправильно»

- Компонент:
  - ✅ `components/PostCard.tsx` → `export default function PostCard() { ... }`
  - ❌ `components/post-card.tsx` (вне `components/ui`).
- Хук:
  - ✅ `hooks/usePipeline.ts` → `export const usePipeline = () => { ... }`
  - ❌ `hooks/pipelineHook.ts`, `hooks/pipeline.ts`.
- Утилита:
  - ✅ `lib/dateUtils.ts` → `export function formatPostDate(...)`
  - ❌ `lib/utils2.ts` с нечётким назначением.

## File & Folder Placement Rules

### Страницы и маршруты (`app/`)

- Новые пользовательские страницы:
  - Создаём сегмент в `app/<route>/page.tsx`.
  - При необходимости состояния загрузки/ошибки:
    - `app/<route>/loading.tsx` — скелетон или индикатор загрузки.
    - `app/<route>/error.tsx` — локальный error boundary.
- Если в будущем понадобятся отдельные подсекции:
  - Можно использовать группирующие сегменты: `app/(dashboard)/page.tsx`, `app/(posts)/posts/page.tsx`, и т.п.
  - Общий shell (sidebar + header) желательно сохранять в `app/layout.tsx` либо вынести в сегментные `layout.tsx`.

### Компоненты (`components/`)

- Презентационные/композиционные компоненты, привязанные к конкретным страницам:
  - Размещаем в `components/` или группируем по фичам (см. раздел «Рекомендованная структура» ниже).
  - Примеры:
    - Компоненты главной: `Dashboard`, `ControlButtons`, `ChannelInput` (через `components/ui/channel-input.tsx`).
    - Компоненты списка постов: `PostsList`, `PostCard`, `OversizedMediaPlaceholder`.
    - Компоненты настроек: `TelegramCredentialsManager`, `HeaderDeleteAllButton`.
- Низкоуровневые UI‑элементы:
  - Размещаем в `components/ui/` (shadcn‑подобные компоненты).
  - Используем только как building blocks, без бизнес‑логики.

### Хуки (`hooks/`)

- Логика работы с API, данными и локальным состоянием, не завязанная на конкретную разметку:
  - Общие доменные хуки:
    - `usePipeline` — управление пайплайном и его статусом.
    - `usePosts` — загрузка/перевод/удаление постов.
    - `useChannel` — работа с текущим каналом.
    - `useLargeMediaLoad` — загрузка большого медиа.
  - UI‑специфичные хуки:
    - `usePostLimit`, `usePostsSort`, `useProgressToast`, `useIsMobile`.
- Правила:
  - Вся работа с React Query сосредоточена в хуках и/или сервисах, а не в компонентах страницы напрямую.
  - Хуки не делают прямых side effects вне UI‑сценария (например, логирование в консоль допускается, но бизнес‑решения — в слоях API/сервиса).

### Сервисы (`services/`)

- HTTP‑клиент:
  - `services/apiClient.ts`:
    - Единственная точка низкоуровневого `fetch`.
    - Обеспечивает таймауты, обработку ошибок и базовый URL (через `resolveBaseURL` и `API_CONFIG`).
- Доменные сервисы:
  - `services/api.ts`:
    - Методы для работы с пайплайном (`pipelineAPI`), постами (`getPosts`, `translatePost`, `deletePost`, `deleteAllPosts`), каналом (`saveChannel`, `getCurrentChannel`, `checkChannel`, `deleteCurrentChannel`), медиа (`loadLargeMedia`) и Telegram‑credentials.
  - `services/translation.ts`:
    - Методы `translateText`, `translateBatch`, `getConfig`, `checkHealth` для внешнего сервиса перевода.
- Правила:
  - Новые эндпоинты бекенда добавляем сначала в `services/api.ts` (или отдельный сервисный модуль), затем уже используем в хуках и компонентах.
  - В компонентах и хуках не вызываем `fetch` напрямую — только через `services/*`.

### Утилиты и константы (`lib/`, `constants/`)

- `lib/`:
  - Любые функции, не зависящие от React/DOM.
  - Повторно используемое форматирование, вычисления, обработка ошибок, ключи для кэша.
- `constants/`:
  - Только конфигурация и статические значения (без функций).
  - Константы, завязанные на окружение (`API_CONFIG.BASE_URL`, `TRANSLATION_BASE_URL`) и текстовые константы (`MESSAGES`).

### Типы (`types/`)

- `types/api.ts`:
  - Описывает все формы запросов/ответов бекенда и основные доменные сущности.
  - При добавлении новых эндпоинтов: сначала расширяем типы, затем слой сервиса, затем хуки/компоненты.

## Data Fetching & Next.js Practices

### Server vs Client Components

- **Server Components**:
  - По умолчанию все компоненты в `app/` — серверные, кроме тех, где явно указано `'use client'`.
  - Текущие страницы (`app/page.tsx`, `app/posts/page.tsx`) — простые составные серверные компоненты, которые отдают client‑компоненты (`Dashboard`, `PostsList`) — это допустимый и понятный паттерн.
- **Client Components**:
  - Компоненты, использующие хуки (`useState`, `useEffect`, React Query), должны содержать `'use client'` в начале файла:
    - `components/Dashboard.tsx`
    - `components/PostsList.tsx`
    - `components/TelegramCredentialsManager.tsx`
    - `components/ui/sidebar.tsx`
    - и прочие интерактивные компоненты.
  - Общие UI‑компоненты без хуков (`Button`, `Card`, `Input` и т.п.) могут оставаться без `'use client'` и использоваться внутри клиентских компонент.

Правило:  
- Для новых компонентов:
  - Считаем их серверными по умолчанию.
  - Добавляем `'use client'` только если **есть необходимость** в client‑хуках, React Query, `window`, `document` и т.п.

### React Query и работа с данными

- Все запросы к бекенду идут через:
  - `services/api.ts`/`services/translation.ts` → далее используются в хуках (`usePipeline`, `usePosts`, `useChannel`, `useLargeMediaLoad`) с React Query.
- Стейт пайплайна:
  - `usePipeline` использует `useQuery` для периодического опроса статуса и `useMutation` для запуска/остановки.
  - Интервалы опроса регулируются `API_CONFIG.POLLING_INTERVAL` и `API_CONFIG.IDLE_POLLING_INTERVAL`.
- Посты:
  - `usePosts` — единая точка для загрузки и мутаций (перевод, удаление, очистка).
  - Следит за ошибками и success‑сообщениями, возвращает уже подготовленные данные для компонентов.

Правило:  
- Новые сценарии работы с данными реализуем так:
  1. Добавляем типы в `types/api.ts`.
  2. Добавляем методы в `services/api.ts` или `services/translation.ts`.
  3. Создаём хук в `hooks/` (через React Query).
  4. Компоненты используют только хуки, не `fetch` и не `services` напрямую.

### Route Handlers (`app/api`)

- Текущее использование:
  - `app/api/posts/[postId]/media/[mediaId]/load-large/route.ts` — проксирует запрос на бекенд.
- При добавлении новых Route Handlers:
  - Сигнатура обработчика должна соответствовать официальной документации Next.js:
    - Пример:
      ```ts
      export async function POST(
        req: NextRequest,
        { params }: { params: { postId: string; mediaId: string } }
      ) { /* ... */ }
      ```
  - Не используем `Promise` для `params` — это объект, предоставляемый Next.js (здесь есть риск ошибки, рекомендуется перепроверить существующие обработчики по документации Next 16).
  - Внутри Route Handler можно вызывать `services` или `fetch` до бекенда, но **не** использовать React/JSX.

### Кеширование и рефетч

- Ответственность за кеширование в основном на React Query:
  - Стало/стало время (`staleTime`), `refetchInterval`, `retry`, `gcTime` задаются при создании `QueryClient` в `app/providers.tsx` и в отдельных хук‑конфигурациях.
- Для Next.js встроенного кеширования `fetch`:
  - В текущем проекте не используется (данные берутся в клиенте через React Query).
  - Если в будущем появятся чисто серверные страницы без интерактива, можно использовать `fetch` с `next: { revalidate }` в серверных компонентах.

## Recommended Structural Improvements

> Важно: ниже — рекомендации. Они **не изменяют** текущую бизнес‑логику и не обязательны к немедленной реализации.

1. **Уточнить структуру по фичам (мягкий FSD на фронте)**:
   - Предлагаемый вариант (см. дерево ниже):
     - `features/pipeline/` — `Dashboard`, `ControlButtons`, хуки и вспомогательные компоненты пайплайна.
     - `features/posts/` — `PostsList`, `PostCard`, `OversizedMediaPlaceholder`, `HeaderDeleteAllButton`, хуки `usePosts`, `usePostsSort`, `useLargeMediaLoad`.
     - `features/settings/` — `SettingsSidebar`, `TelegramCredentialsManager`, `SocialIcon`‑usage.
   - Польза: проще ориентироваться по фичам и избегать свалки в `components/` и `hooks/`.

2. **Унифицировать нейминг хуков**:
   - Правило: файл = имя хука (`useXxx.ts`).

3. **Упорядочить навигационные компоненты**:
   - Основную навигацию держать в `AppSidebar + NavMain + NavUser + SiteHeader`.
   - Дополнительные навигационные компоненты добавлять только при реальной необходимости, избегая дублирования.

4. **Актуализировать Route Handler**:
   - В `app/api/posts/[postId]/media/[mediaId]/load-large/route.ts` скорректировать тип `params` (убрать `Promise`, использовать объект), чтобы соответствовать Next.js 16.

5. **A11y‑улучшения**:
   - В `app/globals.css` сейчас глобально сброшены фокусы (`*:focus`, `*:focus-visible`).
   - Рекомендуется:
     - Либо вернуть стандартный outline, либо реализовать кастомные focus‑стили на компонентах (Button, Input и т.п.) вместо полного отключения.

## Proposed Improved Structure (Tree)

```text
frontend/
  app/
    layout.tsx
    page.tsx              # использует features/pipeline/Dashboard
    error.tsx
    loading.tsx
    globals.css
    posts/
      page.tsx            # использует features/posts/PostsList
      loading.tsx
    settings/
      page.tsx            # использует features/settings/TelegramCredentialsManager и др.
    api/
      posts/[postId]/media/[mediaId]/load-large/route.ts

  features/
    pipeline/
      components/
        Dashboard.tsx
        ControlButtons.tsx
      hooks/
        usePipeline.ts
        usePostLimit.ts
        useProgressToast.tsx
        useChannel.ts
      index.ts            # реэкспорт основных компонент/хуков

    posts/
      components/
        PostsList.tsx
        PostCard.tsx
        OversizedMediaPlaceholder.tsx
        HeaderDeleteAllButton.tsx
      hooks/
        usePosts.ts
        usePostsSort.ts
        useLargeMediaLoad.ts

    settings/
      components/
        TelegramCredentialsManager.tsx
        SettingsSidebar.tsx   # потенциальный вынос из app/settings/page.tsx

  components/
    layout/
      AppSidebar.tsx
      NavMain.tsx
      NavUser.tsx
      SiteHeader.tsx
    ui/
      button.tsx
      card.tsx
      alert.tsx
      input.tsx
      sidebar.tsx
      sheet.tsx
      tooltip.tsx
      progress.tsx
      social-icons.tsx
      ...другие shadcn‑компоненты

  hooks/
    useIsMobile.ts        # вместо use-mobile.ts (после миграции)

  services/
    apiClient.ts
    api.ts
    translation.ts

  lib/
    dateUtils.ts
    errorUtils.ts
    queryKeys.ts
    utils.ts

  constants/
    index.ts

  types/
    api.ts
```

> Примечание: переход к `features/*` можно делать постепенно, по мере доработок. До миграции допустимо сохранять текущую структуру, но новые фичи лучше сразу класть в `features/`.

## LLM Guidelines

Этот раздел — прямые инструкции для LLM, работающих с проектом.

1. **Всегда сначала изучай существующую структуру.**
   - Перед изменениями посмотри `app/`, `components/`, `hooks/`, `services/`, `lib/`, `types/`, `constants/`.
   - Сверься с этим файлом `PROJECT_RULES.md`.

2. **Не меняй архитектуру радикально без запроса.**
   - Не переносить проект целиком на новую структуру без явной просьбы пользователя.
   - Допустимо:
     - Выделить новый компонент/хук, если это локальный, очевидный рефакторинг.
     - Добавить новые файлы/директории в рамках описанных правил (например, новый хук в `hooks/`, новый сервис в `services/`).

3. **Соблюдай нейминг и размещение файлов.**
   - Компоненты:
     - Файл `PascalCase.tsx` (кроме `components/ui`).
     - Имя компонента совпадает с именем файла.
   - Хуки:
     - Файл `useXxx.ts(x)`, функция `useXxx`.
   - Утилиты:
     - В `lib/`, имя описывает назначение.
   - Сервисы:
     - В `services/`, доступ к HTTP только через `apiClient`/`createApiClient`.

4. **Работа с данными.**
   - Не добавляй `fetch` напрямую в компоненты страниц.
   - Используй React Query + сервисы:
     - Добавь метод в `services/api.ts`.
     - Создай/расширь хук в `hooks/`.
     - Подключи хук в компоненте.

5. **Server/Client Components.**
   - Не ставь `'use client'` в `app/layout.tsx` и других корневых layout’ах без острой необходимости.
   - Если нужна клиентская логика — выноси её в дочерний компонент с `'use client'` (как сделано с `Providers` и `Dashboard`).

6. **При неопределённости — уточняй.**
   - Если есть несколько валидных вариантов (например, где разместить новый компонент — в `components/` или `features/...`), опиши варианты и попроси пользователя выбрать.
   - Если не уверен в API Next.js 16 — явно отметь это и укажи, что нужно перепроверить по официальной документации.

7. **Не трогай бизнес‑логику без явной просьбы.**
   - Можно:
     - Почистить структуру, нейминг, дублирование кода.
     - Вынести повторяющийся JSX в отдельные компоненты.
   - Нельзя:
     - Менять смысловые условия, протоколы взаимодействия с бекендом, формат данных, если пользователь не просил и нет явной ошибки.
