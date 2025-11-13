'use client';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePipeline } from '@/hooks/usePipeline';
import { usePostLimit } from '@/hooks/usePostLimit';
import { useChannel } from '@/hooks/useChannel';
import { useProgressToast } from '@/hooks/useProgressToast';
import { ControlButtons } from './ControlButtons';
import { Card, CardContent } from './ui/card';
import { NumberInput } from './ui/number-input';
import { Switch } from './ui/switch';
import { ChannelInput } from './ui/channel-input';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { getUserTelegramCredentials } from '@/services/api';
import type { UserTelegramCredentialsResponse } from '@/types/api';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function Dashboard() {
  const { status, error, success, runPipeline, stopPipeline, isLoading } = usePipeline();
  const { postLimit, validationError, setPostLimitValue } = usePostLimit();
  const [periodHours, setPeriodHours] = useState<number>(1);
  const [isTopPosts, setIsTopPosts] = useState<boolean>(false);

  // Проверяем наличие user credentials
  const userCredsQuery = useQuery<UserTelegramCredentialsResponse, Error>({
    queryKey: ['user-telegram-credentials'],
    queryFn: ({ signal }) => getUserTelegramCredentials(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasUserCredentials = userCredsQuery.data?.has_credentials ?? false;

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

    // Проверяем наличие user credentials (теперь обязательно)
    if (!hasUserCredentials) {
      toast.error('Сначала добавьте свои Telegram credentials в настройках');
      return;
    }

    const channelUrl = channelUsername.startsWith('@')
      ? `t.me/${channelUsername.slice(1)}`
      : `t.me/${channelUsername}`;
    void runPipeline(postLimit, periodHours, channelUrl, isTopPosts, true); // Всегда используем user credentials
  }, [
    validationError,
    channelUsername,
    runPipeline,
    postLimit,
    periodHours,
    isTopPosts,
    hasUserCredentials,
  ]);

  const isRunButtonDisabled = useMemo(
    () => !!validationError || isLoading,
    [validationError, isLoading]
  );

  return (
    <div className='min-h-screen bg-background'>
      <div>
        {/* Предупреждение если нет credentials */}
        {!hasUserCredentials && (
          <Alert className='mb-4 border-orange-200 bg-orange-50'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex-1'>
                <p className='text-sm font-medium text-orange-900 mb-1'>
                  ⚠️ Требуется настройка Telegram credentials
                </p>
                <p className='text-sm text-orange-700'>
                  Для работы парсера необходимо добавить ваши Telegram API credentials
                </p>
              </div>
              <Link href='/settings'>
                <Button size='sm' variant='default'>
                  <Settings className='h-4 w-4 mr-2' />
                  Настроить
                </Button>
              </Link>
            </div>
          </Alert>
        )}

        <Card className='bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm @container/card'>
          <CardContent className='px-6 pt-0 space-y-4'>
            <div>
              <label className='block text-sm font-medium mb-2'>Канал</label>
              <ChannelInput
                value={channelUsername}
                onValueChange={handleChannelChange}
                onSave={handleChannelSave}
                onUnsave={handleChannelUnsave}
                isSaved={isChannelSaved}
                disabled={status.is_running || isLoading}
                placeholder='канал'
              />
            </div>

            <hr className='border-border' />

            <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-8'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 md:flex md:gap-8'>
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

              <div className='relative md:pl-8'>
                <div className='hidden md:block absolute left-0 top-0 bottom-0 w-px bg-border'></div>
                <div className='flex items-center justify-between md:justify-start gap-6'>
                  <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                    Только топ посты
                  </label>
                  <Switch
                    checked={isTopPosts}
                    onCheckedChange={setIsTopPosts}
                    disabled={status.is_running || isLoading}
                  />
                </div>
              </div>

              <div className='relative md:pl-8'>
                <div className='hidden md:block absolute left-0 top-0 bottom-0 w-px bg-border'></div>
                <ControlButtons
                  onRun={handleRun}
                  onStop={stopPipeline}
                  isRunning={status.is_running}
                  disabled={isRunButtonDisabled}
                  loading={isLoading}
                />
              </div>
            </div>

            {validationError && (
              <p className='text-red-600 text-sm font-medium'>{validationError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
