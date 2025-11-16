'use client';

import { Spinner } from '@/components/ui/spinner';

export default function PostsLoading() {
  return (
    <div className='flex min-h-[200px] items-center justify-center'>
      <Spinner />
    </div>
  );
}

