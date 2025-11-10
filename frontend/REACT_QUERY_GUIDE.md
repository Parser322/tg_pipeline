# 📘 Руководство по работе с React Query в проекте

## 🎯 Быстрый старт

### Создание нового запроса (Query)

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/errorUtils';
import type { YourDataType } from '@/types/api';

export const useYourData = () => {
  const query = useQuery<YourDataType, Error>({
    queryKey: queryKeys.yourData, // Добавь ключ в lib/queryKeys.ts
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/your-endpoint', signal);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      return response.data;
    },
    staleTime: 30_000, // 30 секунд
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
};
```

---

### Создание мутации (Mutation)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { OkResponse } from '@/types/api';

export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<OkResponse, Error, UpdateItemParams>({
    mutationFn: (params) => apiClient.post('/update', params),
    onSuccess: () => {
      // Инвалидация связанных запросов
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
    },
  });

  return {
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
};
```

---

### Оптимистические обновления

```typescript
const mutation = useMutation<OkResponse, Error, string>({
  mutationFn: (itemId) => deleteItem(itemId),

  // 1. Сохраняем текущее состояние перед изменением
  onMutate: async (itemId) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.items });

    const previousItems = queryClient.getQueryData<Item[]>(queryKeys.items);

    // 2. Оптимистически обновляем UI
    queryClient.setQueryData<Item[]>(
      queryKeys.items,
      (old) => old?.filter((item) => item.id !== itemId) ?? []
    );

    return { previousItems };
  },

  // 3. Откатываем при ошибке
  onError: (err, itemId, context) => {
    if (context?.previousItems) {
      queryClient.setQueryData(queryKeys.items, context.previousItems);
    }
  },

  // 4. Синхронизируем с сервером
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.items });
  },
});
```

---

## 📋 Чек-лист для каждого запроса

- [ ] **Типизация**: `useQuery<TData, Error>` или `useMutation<TData, Error, TVariables>`
- [ ] **QueryKey**: Добавлен в `lib/queryKeys.ts`
- [ ] **Signal**: Передается в `queryFn` для возможности отмены
- [ ] **Обработка ошибок**: Используется `getErrorMessage` из `lib/errorUtils.ts`
- [ ] **StaleTime**: Установлен явно (если нужен кастомный)
- [ ] **Инвалидация**: После мутаций инвалидируются связанные запросы

---

## 🔑 Работа с Query Keys

**Файл:** `lib/queryKeys.ts`

```typescript
export const queryKeys = {
  // Простые ключи
  posts: ['posts'] as const,

  // Параметризованные ключи
  post: (id: string) => ['post', id] as const,

  // Вложенные структуры
  user: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    profile: (id: string) => ['users', id, 'profile'] as const,
  },
} as const;
```

**Использование:**

```typescript
queryKey: queryKeys.posts,        // ['posts']
queryKey: queryKeys.post('123'),  // ['post', '123']
queryKey: queryKeys.user.all,     // ['users']
```

---

## ⚙️ Глобальные настройки

**Файл:** `app/providers.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Одна попытка повтора
      refetchOnWindowFocus: true, // Обновлять при фокусе
      staleTime: 30_000, // 30 сек - данные считаются свежими
      gcTime: 5 * 60 * 1000, // 5 мин - удаление из кеша
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## 🎨 Паттерны использования

### 1. Динамический интервал обновления

```typescript
const statusQuery = useQuery({
  queryKey: queryKeys.status,
  queryFn: fetchStatus,
  refetchInterval: (query) => (query.state.data?.is_active ? 1000 : 60_000), // 1 сек или 1 мин
});
```

### 2. Зависимый запрос (enabled)

```typescript
const userQuery = useQuery({
  queryKey: queryKeys.user(userId),
  queryFn: () => fetchUser(userId),
  enabled: !!userId, // Запускается только если userId существует
});
```

### 3. Select для производных данных

```typescript
const postsQuery = useQuery({
  queryKey: queryKeys.posts,
  queryFn: fetchPosts,
  select: (data) => ({
    posts: data,
    count: data.length,
    hasNew: data.some((p) => p.isNew),
    sorted: [...data].sort((a, b) => b.id - a.id),
  }),
});
```

### 4. Кэширование результата проверки

```typescript
await queryClient.fetchQuery({
  queryKey: queryKeys.check(value),
  queryFn: () => checkValue(value),
  staleTime: 60_000, // Кэшируем на 1 минуту
});
```

### 5. Инвалидация по паттерну

```typescript
// Инвалидировать все запросы, начинающиеся с ['users']
queryClient.invalidateQueries({
  queryKey: ['users'],
});

// Инвалидировать точный ключ
queryClient.invalidateQueries({
  queryKey: queryKeys.user.detail('123'),
  exact: true,
});
```

---

## 🚫 Антипаттерны (НЕ делай так!)

### ❌ Дублирование состояний

```typescript
// ПЛОХО
const [data, setData] = useState(null);
const query = useQuery({ ... });

useEffect(() => {
  if (query.data) setData(query.data);
}, [query.data]);

// ХОРОШО
const query = useQuery({ ... });
const data = query.data;
```

### ❌ Прямые API вызовы

```typescript
// ПЛОХО
const handleClick = async () => {
  const data = await fetch('/api/data');
  setData(data);
};

// ХОРОШО
const mutation = useMutation({ ... });
const handleClick = () => mutation.mutate();
```

### ❌ Создание QueryClient в компоненте

```typescript
// ПЛОХО
function Component() {
  const queryClient = new QueryClient(); // Пересоздается при каждом рендере!
}

// ХОРОШО
const [queryClient] = useState(() => new QueryClient());
```

### ❌ Игнорирование типизации

```typescript
// ПЛОХО
const query = useQuery({ queryKey: ['data'], queryFn: fetchData });

// ХОРОШО
const query = useQuery<DataType, Error>({
  queryKey: ['data'],
  queryFn: fetchData,
});
```

---

## 🛠 Отладка

### React Query DevTools

Открой DevTools в режиме разработки (правый нижний угол).

**Возможности:**

- Просмотр всех активных запросов
- Состояние кэша
- Ручная инвалидация
- История запросов

### Логирование

```typescript
const query = useQuery({
  queryKey: ['debug'],
  queryFn: fetchData,
  meta: {
    // Любые метаданные для логирования
    debugName: 'MyQuery',
  },
});

console.log('Query state:', {
  status: query.status,
  fetchStatus: query.fetchStatus,
  dataUpdatedAt: query.dataUpdatedAt,
});
```

---

## 📚 Полезные ссылки

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Query Keys Best Practices](https://tkdodo.eu/blog/effective-react-query-keys)
- [Optimistic Updates Guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

## 💡 Советы

1. **Всегда типизируй** запросы - это сэкономит время на отладку
2. **Используй select** для производных данных вместо useMemo
3. **Оптимистические обновления** - для операций удаления/обновления
4. **QueryKeys** - добавляй все ключи в `lib/queryKeys.ts`
5. **Signal** - всегда передавай в queryFn для корректной отмены запросов
6. **DevTools** - твой лучший друг при отладке

---

Удачи! 🚀
