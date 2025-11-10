'use client';

import type { SortBy } from '@/types/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PostsSortSelectorProps {
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
}

const SORT_OPTIONS = {
  saved_at: 'Последние загруженные',
  original_date: 'По времени публикации',
} as const;

export default function PostsSortSelector({ sortBy, onSortChange }: PostsSortSelectorProps) {
  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm text-muted-foreground hidden sm:inline'>Сортировка:</span>
      <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortBy)}>
        <SelectTrigger className='w-[200px] bg-background'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='saved_at'>{SORT_OPTIONS.saved_at}</SelectItem>
          <SelectItem value='original_date'>{SORT_OPTIONS.original_date}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

