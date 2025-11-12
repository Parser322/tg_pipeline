import { useState, useEffect } from 'react';
import type { SortBy } from '@/types/api';

const SORT_STORAGE_KEY = 'tg_pipeline_posts_sort';
const DEFAULT_SORT: SortBy = 'saved_at';

export const usePostsSort = () => {
  // Всегда начинаем с DEFAULT_SORT для SSR и клиента
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT);

  // После монтирования на клиенте загружаем из localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === 'original_date' || stored === 'saved_at') {
      setSortBy(stored);
    }
  }, []);

  // Сохраняем изменения в localStorage
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sortBy);
  }, [sortBy]);

  return {
    sortBy,
    setSortBy,
  };
};

