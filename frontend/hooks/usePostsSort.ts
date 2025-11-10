import { useState, useEffect } from 'react';
import type { SortBy } from '@/types/api';

const SORT_STORAGE_KEY = 'tg_pipeline_posts_sort';
const DEFAULT_SORT: SortBy = 'saved_at';

export const usePostsSort = () => {
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window === 'undefined') return DEFAULT_SORT;
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return (stored === 'original_date' || stored === 'saved_at') ? stored : DEFAULT_SORT;
  });

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sortBy);
  }, [sortBy]);

  return {
    sortBy,
    setSortBy,
  };
};

