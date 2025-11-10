'use client';
import React from 'react';
import { usePipelineContext } from '@/contexts/PipelineContext';
import { usePostLimit } from '@/hooks/usePostLimit';
import { useToast } from '@/contexts/ToastContext';
import { saveChannel, checkChannel, deleteCurrentChannel, getCurrentChannel } from '@/services/api';
import StatusIndicator from './StatusIndicator';
import { ControlButtons } from './ControlButtons';
import { MessageAlerts } from './MessageAlerts';
import { Card, CardContent } from './ui/card';
import { NumberInput } from './ui/number-input';
import { Switch } from './ui/switch';
import { ChannelInput } from './ui/channel-input';
import { Alert, AlertDescription } from './ui/alert';

export default function Dashboard() {
  const { status, error, success, runPipeline, stopPipeline, isLoading } = usePipelineContext();
  const { postLimit, validationError, setPostLimitValue } = usePostLimit();
  const { showToast, updateToast, dismissToast } = useToast();
  const [periodHours, setPeriodHours] = React.useState<number>(1);
  const [channelUsername, setChannelUsername] = React.useState<string>('');
  const [isChannelSaved, setIsChannelSaved] = React.useState<boolean>(false);
  const [isTopPosts, setIsTopPosts] = React.useState<boolean>(false);
  const [channelError, setChannelError] = React.useState<string | null>(null);
  const [channelMessage, setChannelMessage] = React.useState<string | null>(null);
  const channelCheckRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressToastIdRef = React.useRef<string | null>(null);
  const prevIsRunningRef = React.useRef(status.is_running);
  const updateProgressTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    getCurrentChannel()
      .then((response) => {
        if (response.data.channel && response.data.channel.username) {
          const username = response.data.channel.username;
          setChannelUsername(username);
          setIsChannelSaved(true);
          localStorage.setItem('lastUsedChannel', username);
        } else {
          const savedChannel = localStorage.getItem('lastUsedChannel');
          if (savedChannel) {
            setChannelUsername(savedChannel);
            setIsChannelSaved(false);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load saved channel:', err);
        const savedChannel = localStorage.getItem('lastUsedChannel');
        if (savedChannel) {
          setChannelUsername(savedChannel);
          setIsChannelSaved(false);
        }
      });
  }, []);

  const handleRun = () => {
    if (validationError) return;
    const channelUrl = channelUsername.startsWith('@')
      ? `t.me/${channelUsername.slice(1)}`
      : `t.me/${channelUsername}`;
    runPipeline(postLimit, periodHours, channelUrl, isTopPosts);
  };

  const handleChannelSave = async (username: string) => {
    if (!username.trim()) return;
    try {
      const response = await saveChannel(username);
      if (response.data.ok) {
        setIsChannelSaved(true);
        setChannelError(null);
        setChannelMessage('Канал сохранён');
      }
    } catch (err: any) {
      console.error('Failed to save channel:', err);
      setChannelMessage(null);
      setChannelError('Ошибка при сохранении канала');
    }
  };

  const handleChannelUnsave = async (username: string) => {
    if (!username.trim()) return;
    try {
      const response = await deleteCurrentChannel();
      if (response.data.ok) {
        setIsChannelSaved(false);
        setChannelError(null);
        setChannelMessage('Канал удалён');
      }
    } catch (err: any) {
      console.error('Failed to unsave channel:', err);
      setChannelMessage(null);
      setChannelError('Ошибка при удалении канала');
    }
  };

  const handleChannelChange = async (username: string) => {
    setChannelUsername(username);
    if (username.trim()) {
      localStorage.setItem('lastUsedChannel', username);
    } else {
      localStorage.removeItem('lastUsedChannel');
    }
    if (!username.trim()) {
      setIsChannelSaved(false);
      if (channelCheckRef.current) {
        clearTimeout(channelCheckRef.current);
        channelCheckRef.current = null;
      }
      return;
    }
    if (channelCheckRef.current) {
      clearTimeout(channelCheckRef.current);
      channelCheckRef.current = null;
    }
    channelCheckRef.current = setTimeout(async () => {
      try {
        const response = await checkChannel(username);
        setIsChannelSaved(response.data.is_saved);
      } catch (err) {
        console.error('Failed to check channel:', err);
        setIsChannelSaved(false);
      }
    }, 400);
  };

  React.useEffect(() => {
    return () => {
      if (channelCheckRef.current) {
        clearTimeout(channelCheckRef.current);
        channelCheckRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const prevIsRunning = prevIsRunningRef.current;
    const currentIsRunning = status.is_running;
    const hasProgress = status.total > 0;

    if (currentIsRunning && !prevIsRunning && hasProgress) {
      const toastId = showToast({
        title: 'Загрузка',
        progress: {
          processed: status.processed,
          total: status.total,
        },
        duration: 0,
      });
      progressToastIdRef.current = toastId;
    }

    if (currentIsRunning && hasProgress && progressToastIdRef.current) {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
      }

      updateProgressTimeoutRef.current = setTimeout(() => {
        if (progressToastIdRef.current) {
          updateToast(progressToastIdRef.current, {
            title: 'Загрузка',
            progress: {
              processed: status.processed,
              total: status.total,
            },
            duration: 0,
          });
        }
      }, 300);
    }

    if (currentIsRunning && hasProgress && !progressToastIdRef.current) {
      const toastId = showToast({
        title: 'Загрузка',
        progress: {
          processed: status.processed,
          total: status.total,
        },
        duration: 0,
      });
      progressToastIdRef.current = toastId;
    }

    if (!currentIsRunning && prevIsRunning && progressToastIdRef.current) {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
        updateProgressTimeoutRef.current = null;
      }

      updateToast(progressToastIdRef.current, {
        duration: 2000,
      });
      progressToastIdRef.current = null;
    }

    prevIsRunningRef.current = currentIsRunning;

    return () => {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
      }
    };
  }, [status.is_running, status.processed, status.total, showToast, updateToast]);

  return (
    <div className='min-h-screen bg-background'>
      <div>
        <div className='mb-4'>
          <h1 className='text-xl md:text-2xl font-bold mb-1'>Панель управления парсером</h1>
        </div>

        <Card className='shadow-sm rounded-lg'>
          <CardContent className='p-4 space-y-4'>
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
                  onValueChange={(value) => setPostLimitValue(value)}
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
                <div className='flex items-center gap-3'>
                  <ControlButtons
                    onRun={handleRun}
                    onStop={stopPipeline}
                    isRunning={status.is_running}
                    disabled={!!validationError || isLoading}
                    loading={isLoading}
                  />
                  <StatusIndicator
                    isRunning={status.is_running}
                    finished={status.finished}
                    processed={status.processed}
                    total={status.total}
                  />
                </div>
              </div>
            </div>

            {validationError && (
              <p className='text-red-600 text-sm font-medium'>{validationError}</p>
            )}

            <MessageAlerts error={error} success={success} />
            {channelError && (
              <Alert className='border-red-200 bg-red-50 mt-2'>
                <AlertDescription className='text-red-700'>{channelError}</AlertDescription>
              </Alert>
            )}
            {channelMessage && (
              <Alert className='border-green-200 bg-green-50 mt-2'>
                <AlertDescription className='text-green-700'>{channelMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
