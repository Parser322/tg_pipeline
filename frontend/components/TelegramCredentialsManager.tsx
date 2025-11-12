'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  getUserTelegramCredentials,
  saveTelegramCredentials,
  deleteUserTelegramCredentials,
  validateTelegramCredentials,
} from '@/services/api';
import type { UserTelegramCredentialsResponse, OkResponse, ValidateCredentialsResponse } from '@/types/api';

export function TelegramCredentialsManager() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [sessionString, setSessionString] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Загружаем текущие credentials
  const credentialsQuery = useQuery<UserTelegramCredentialsResponse, Error>({
    queryKey: ['user-telegram-credentials'],
    queryFn: ({ signal }) => getUserTelegramCredentials(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Мутация для сохранения
  const saveMutation = useMutation<OkResponse, Error, void>({
    mutationFn: async () => {
      if (!apiId || !apiHash || !sessionString) {
        throw new Error('Заполните все обязательные поля');
      }
      
      return saveTelegramCredentials({
        telegram_api_id: parseInt(apiId),
        telegram_api_hash: apiHash,
        telegram_string_session: sessionString,
        phone_number: phoneNumber || null,
      });
    },
    onSuccess: () => {
      toast.success('Telegram credentials успешно сохранены!');
      setIsEditing(false);
      setApiId('');
      setApiHash('');
      setSessionString('');
      setPhoneNumber('');
      void queryClient.invalidateQueries({ queryKey: ['user-telegram-credentials'] });
    },
    onError: (error) => {
      toast.error('Ошибка сохранения', {
        description: error.message || 'Не удалось сохранить credentials',
      });
    },
  });

  // Мутация для удаления
  const deleteMutation = useMutation<OkResponse, Error, void>({
    mutationFn: deleteUserTelegramCredentials,
    onSuccess: () => {
      toast.success('Credentials удалены');
      void queryClient.invalidateQueries({ queryKey: ['user-telegram-credentials'] });
    },
    onError: (error) => {
      toast.error('Ошибка удаления', {
        description: error.message,
      });
    },
  });

  // Мутация для валидации
  const validateMutation = useMutation<ValidateCredentialsResponse, Error, void>({
    mutationFn: validateTelegramCredentials,
    onSuccess: (data) => {
      if (data.valid) {
        toast.success('Credentials валидны!', {
          description: data.message,
        });
      } else {
        toast.error('Credentials невалидны', {
          description: data.message,
        });
      }
    },
    onError: (error) => {
      toast.error('Ошибка валидации', {
        description: error.message,
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (confirm('Вы уверены, что хотите удалить свои Telegram credentials?')) {
      deleteMutation.mutate();
    }
  };

  const handleValidate = () => {
    validateMutation.mutate();
  };

  const hasCredentials = credentialsQuery.data?.has_credentials ?? false;
  const isLoading = credentialsQuery.isLoading || saveMutation.isPending || deleteMutation.isPending;

  return (
    <Card className='shadow-sm rounded-lg'>
      <CardContent className='p-4 space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Telegram API Credentials</h3>
            <p className='text-sm text-gray-600 mt-1'>
              Настройте свои credentials для работы с Telegram API
            </p>
          </div>
          {hasCredentials && (
            <Badge variant='default' className='bg-green-600'>
              ✓ Сохранено
            </Badge>
          )}
        </div>

        {hasCredentials && !isEditing ? (
          <div className='space-y-3'>
            <Alert>
              <div className='space-y-2'>
                <p className='text-sm'>
                  <strong>API ID:</strong> {credentialsQuery.data?.telegram_api_id}
                </p>
                {credentialsQuery.data?.phone_number && (
                  <p className='text-sm'>
                    <strong>Телефон:</strong> {credentialsQuery.data.phone_number}
                  </p>
                )}
                {credentialsQuery.data?.created_at && (
                  <p className='text-sm text-gray-500'>
                    Добавлено: {new Date(credentialsQuery.data.created_at).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
            </Alert>

            <div className='flex gap-2'>
              <Button
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                variant='outline'
                size='sm'
              >
                {validateMutation.isPending ? 'Проверка...' : 'Проверить валидность'}
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                variant='outline'
                size='sm'
              >
                Изменить
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                variant='destructive'
                size='sm'
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        ) : (
          <div className='space-y-3'>
            <Alert>
              <p className='text-sm mb-2'>
                Получите свои API credentials на{' '}
                <a
                  href='https://my.telegram.org/apps'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline font-medium'
                >
                  my.telegram.org/apps
                </a>
              </p>
              <p className='text-xs text-gray-600'>
                ℹ️ Session String можно получить, запустив авторизацию через telethon или pyrogram.
              </p>
            </Alert>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                API ID <span className='text-red-500'>*</span>
              </label>
              <Input
                type='number'
                placeholder='12345678'
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                API Hash <span className='text-red-500'>*</span>
              </label>
              <Input
                type='text'
                placeholder='abcdef1234567890abcdef1234567890'
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                Session String <span className='text-red-500'>*</span>
              </label>
              <Input
                type='password'
                placeholder='1BVtsOLUBu...'
                value={sessionString}
                onChange={(e) => setSessionString(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>Номер телефона (опционально)</label>
              <Input
                type='tel'
                placeholder='+7...'
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className='flex gap-2 pt-2'>
              <Button
                onClick={handleSave}
                disabled={isLoading || !apiId || !apiHash || !sessionString}
              >
                {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
              {hasCredentials && (
                <Button
                  onClick={() => setIsEditing(false)}
                  variant='outline'
                  disabled={isLoading}
                >
                  Отмена
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

