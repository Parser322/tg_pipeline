'use client';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePipeline } from '@/hooks/usePipeline';
import { usePostLimit } from '@/hooks/usePostLimit';
import { useChannel } from '@/hooks/useChannel';
import { useProgressToast } from '@/hooks/useProgressToast';

import { NumberInput } from './ui/number-input';
import { Switch } from './ui/switch';
import { ChannelInput } from './ui/channel-input';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { getGlobalTelegramCredentials } from '@/services/api';
import type { UserTelegramCredentialsResponse } from '@/types/api';
import Link from 'next/link';
import { IconSettings, IconPlayerPlay, IconSquare, IconLoader2 } from '@tabler/icons-react';

export default function Dashboard() {
  const { status, error, success, runPipeline, stopPipeline, isLoading } = usePipeline();
  const { postLimit, validationError, setPostLimitValue } = usePostLimit();
  const [periodHours, setPeriodHours] = useState<number>(1);
  const [isTopPosts, setIsTopPosts] = useState<boolean>(false);

  // Проверяем наличие глобальных credentials (для всех пользователей)
  const globalCredsQuery = useQuery<UserTelegramCredentialsResponse, Error>({
    queryKey: ['global-telegram-credentials'],
    queryFn: ({ signal }) => getGlobalTelegramCredentials(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasGlobalCredentials = globalCredsQuery.data?.has_credentials ?? false;
  const shouldShowCredsAlert = globalCredsQuery.isSuccess && !hasGlobalCredentials;

  const {
    channelUsername,
    isChannelSaved,
    channelError,
    channelMessage,
    handleChannelSave,
    handleChannelUnsave,
    handleChannelChange,
  } = useChannel();

  useProgressToast(status);

  useEffect(() => {
    if (error) {
      toast.error('Ошибка', { description: error });
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      toast(success);
    }
  }, [success]);

  useEffect(() => {
    if (channelError) {
      toast.error('Ошибка канала', { description: channelError });
    }
  }, [channelError]);

  useEffect(() => {
    if (channelMessage) {
      toast('Готово', { description: channelMessage });
    }
  }, [channelMessage]);

  const handleRun = useCallback(() => {
    if (validationError) return;

    const channelUrl = channelUsername.startsWith('@')
      ? `t.me/${channelUsername.slice(1)}`
      : `t.me/${channelUsername}`;
    void runPipeline(postLimit, periodHours, channelUrl, isTopPosts, false); // Всегда используем глобальные credentials
  }, [
    validationError,
    channelUsername,
    runPipeline,
    postLimit,
    periodHours,
    isTopPosts,
  ]);

  const isRunButtonDisabled = useMemo(
    () => !!validationError || isLoading,
    [validationError, isLoading]
  );

  return (
    <div className='bg-background'>
      <div>
        {/* Предупреждение если нет глобальных credentials */}
        {shouldShowCredsAlert && (
          <Alert className='mb-4 border-orange-200 bg-orange-50'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex-1'>
                <p className='text-sm font-medium text-orange-900 mb-1'>
                  ⚠️ Не настроены Telegram credentials
                </p>
                <p className='text-sm text-orange-700'>
                  Администратор должен добавить глобальные Telegram API credentials в настройках.
                </p>
              </div>
              <Link href='/settings'>
                <Button size='sm' variant='default'>
                  <IconSettings className='h-4 w-4 mr-2' />
                  Настройки
                </Button>
              </Link>
            </div>
          </Alert>
        )}

        <div className='space-y-8'>
          <div className='space-y-4'>
            <label className='block text-lg font-medium'>Канал</label>
            <ChannelInput
              value={channelUsername}
              onValueChange={handleChannelChange}
              onSave={handleChannelSave}
              onUnsave={handleChannelUnsave}
              isSaved={isChannelSaved}
              disabled={status.is_running || isLoading}
              placeholder='Введите канал (например, @durov)'
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-start'>
            <div className='space-y-6'>
              <div className='flex flex-col gap-4'>
                <NumberInput
                  label='Количество постов'
                  value={postLimit}
                  onValueChange={setPostLimitValue}
                  min={1}
                  max={1000}
                  disabled={status.is_running || isLoading}
                />
                <NumberInput
                  label='Период в часах'
                  value={periodHours}
                  onValueChange={setPeriodHours}
                  min={1}
                  max={168}
                  disabled={status.is_running || isLoading}
                />
              </div>
              
              
              <label className='flex w-full items-center gap-3 rounded-lg border border-input p-4 cursor-pointer transition-colors hover:bg-accent/50 has-[:checked]:bg-primary/5 has-[:checked]:border-primary'>
                <input
                  type='checkbox'
                  checked={isTopPosts}
                  onChange={(e) => setIsTopPosts(e.target.checked)}
                  disabled={status.is_running || isLoading}
                  className='peer size-4 shrink-0 rounded border border-input shadow-xs transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:text-primary-foreground checked:border-primary appearance-none grid place-content-center before:content-["✓"] before:text-[10px] before:text-transparent checked:before:text-current'
                />
                <div className='flex-1'>
                  <div className='text-sm font-medium leading-none'>
                    Только топ посты
                  </div>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Парсить только популярные посты
                  </p>
                </div>
              </label>
            </div>

            <div className='flex flex-col gap-4'>
              {/* Control button */}
              {isLoading ? (
                <Button
                  disabled
                  size='lg'
                  className='w-full h-12 gap-2'
                >
                  <IconLoader2 className='h-5 w-5 animate-spin' />
                  <span>{status.is_running ? 'Остановка...' : 'Запуск...'}</span>
                </Button>
              ) : status.is_running ? (
                <Button
                  onClick={stopPipeline}
                  variant='destructive'
                  size='lg'
                  className='w-full h-12 gap-2'
                >
                  <IconSquare className='h-5 w-5' />
                  <span>Остановить парсер</span>
                </Button>
              ) : (
                <Button
                  onClick={handleRun}
                  disabled={isRunButtonDisabled}
                  size='lg'
                  className='w-full h-12 gap-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                >
                  <IconPlayerPlay className='h-5 w-5' />
                  <span>Запустить парсер</span>
                </Button>
              )}
            </div>
          </div>

          {validationError && (
            <p className='text-red-600 text-sm font-medium'>{validationError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
