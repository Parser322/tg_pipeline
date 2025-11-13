import { IconLoader2 } from '@tabler/icons-react';

export default function PostsLoading() {
  return (
    <div className='flex flex-col items-center justify-center py-12'>
      <IconLoader2 className='h-8 w-8 animate-spin text-primary mb-4' />
      <p className='text-sm text-muted-foreground'>Загрузка постов...</p>
    </div>
  );
}

