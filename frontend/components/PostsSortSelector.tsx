'use client';

import type { SortBy } from '@/types/api';
import { Clock, Calendar } from 'lucide-react';
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
  saved_at: { label: 'Последние загруженные', icon: Clock },
  original_date: { label: 'По времени публикации', icon: Calendar },
} as const;

export default function PostsSortSelector({ sortBy, onSortChange }: PostsSortSelectorProps) {
  const CurrentIcon = SORT_OPTIONS[sortBy].icon;

  return (
    <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortBy)}>
      <SelectTrigger className='w-[248px] bg-background'>
        <div className='flex items-center gap-2 mr-2'>
          <CurrentIcon className='w-4 h-4' />
          <span>{SORT_OPTIONS[sortBy].label}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='saved_at'>
          <div className='flex items-center gap-2'>
            <Clock className='w-4 h-4' />
            <span>{SORT_OPTIONS.saved_at.label}</span>
          </div>
        </SelectItem>
        <SelectItem value='original_date'>
          <div className='flex items-center gap-2'>
            <Calendar className='w-4 h-4' />
            <span>{SORT_OPTIONS.original_date.label}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
