'use client';
import React from 'react';
import { usePipelineContext } from '@/contexts/PipelineContext';
import { usePostLimit } from '@/hooks/usePostLimit';
import { saveChannel, checkChannel, deleteCurrentChannel, getCurrentChannel } from '@/services/api';
import StatusIndicator from './StatusIndicator';
import { ProgressSection } from './ProgressSection';
import { ControlButtons } from './ControlButtons';
import { MessageAlerts } from './MessageAlerts';
import { Card, CardContent } from './ui/card';
import { NumberInput } from './ui/number-input';
import { Switch } from './ui/switch';
import { ChannelInput } from './ui/channel-input';
import { Alert, AlertDescription } from './ui/alert';
import PostsList from './PostsList';

export default function Dashboard() {
  const { status, error, success, runPipeline, stopPipeline } = usePipelineContext();
  const { postLimit, validationError, setPostLimitValue } = usePostLimit();
  const [periodHours, setPeriodHours] = React.useState<number>(1);
  const [channelUsername, setChannelUsername] = React.useState<string>('');
  const [isChannelSaved, setIsChannelSaved] = React.useState<boolean>(false);
  const [isTopPosts, setIsTopPosts] = React.useState<boolean>(false);
  const [channelError, setChannelError] = React.useState<string | null>(null);
  const [channelMessage, setChannelMessage] = React.useState<string | null>(null);

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
    const channelUrl = channelUsername.startsWith('@') ? `t.me/${channelUsername.slice(1)}` : `t.me/${channelUsername}`;
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
      return;
    }
    try {
      const response = await checkChannel(username);
      setIsChannelSaved(response.data.is_saved);
    } catch (err) {
      console.error('Failed to check channel:', err);
      setIsChannelSaved(false);
    }
  };

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-7xl mx-auto px-6 py-8'>
        <div className='mb-8'>
          <h1 className='text-2xl font-bold mb-1'>Parser322</h1>
        </div>

        <Card className='shadow-sm rounded-lg'>
          <CardContent className='p-6 space-y-6'>
            <div>
              <label className='block text-sm font-medium mb-2'>Канал</label>
              <ChannelInput
                value={channelUsername}
                onChange={handleChannelChange}
                onSave={handleChannelSave}
                onUnsave={handleChannelUnsave}
                isSaved={isChannelSaved}
                disabled={status.is_running}
                placeholder='канал'
              />
            </div>

            <hr className='border-border' />

            <div className='flex items-start gap-8 h-20'>
              <div className='flex gap-8'>
                <NumberInput
                  label='Количество постов'
                  value={postLimit}
                  onChange={(value) => setPostLimitValue(value)}
                  min={1}
                  max={1000}
                  disabled={status.is_running}
                />

                <div className='relative'>
                  <div className='absolute left-0 top-0 h-20 w-px bg-border'></div>
                  <div className='pl-8'>
                    <NumberInput
                      label='Период в часах'
                      value={periodHours}
                      onChange={setPeriodHours}
                      min={1}
                      max={168}
                      disabled={status.is_running}
                    />
                  </div>
                </div>
              </div>

              <div className='relative'>
                <div className='absolute left-0 top-0 h-20 w-px bg-border'></div>
                <div className='pl-8'>
                  <div className='flex items-start justify-between gap-8'>
                    <div>
                      <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                        Только топ посты
                      </label>
                    </div>
                    <Switch
                      checked={isTopPosts}
                      onCheckedChange={setIsTopPosts}
                      disabled={status.is_running}
                      className='mt-0.5'
                    />
                  </div>
                </div>
              </div>

              <div className='relative'>
                <div className='absolute left-0 top-0 h-20 w-px bg-border'></div>
                <div className='pl-8 flex items-center h-20'>
                  <div className='flex items-center gap-3'>
                    <ControlButtons
                      onRun={handleRun}
                      onStop={stopPipeline}
                      isRunning={status.is_running}
                      disabled={!!validationError}
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
            </div>

            {status.total > 0 && (
              <ProgressSection processed={status.processed} total={status.total} />
            )}
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

        <div className='mt-3'>
          <PostsList />
        </div>
      </div>
    </div>
  );
}



